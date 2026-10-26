import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import type { Db } from '../db.js'
import { getDb } from '../db.js'
import { HttpError, handler, notFound, param } from '../http.js'
import { buildUpdate } from '../lib/sql.js'
import { nextOrderCode } from '../lib/sequence.js'
import { fireOrderToKitchen } from '../lib/tickets.js'
import { todayISO } from '../lib/codes.js'
import { orderItemPatchSchema, orderItemSchema, orderPatchSchema, orderSchema, parse } from '../schemas.js'

export const ordersRouter = Router()

const columns = {
  tableId: 'table_id',
  type: 'type',
  guests: 'guests',
  notes: 'notes',
  businessDate: 'business_date',
  status: 'status',
}

const ORDER_SELECT = `
  SELECT o.id,
         o.order_code AS "orderCode",
         o.business_date::text AS "businessDate",
         o.table_id AS "tableId",
         t.label AS "tableLabel",
         o.type,
         o.status,
         o.guests,
         o.notes,
         o.opened_at AS "openedAt",
         o.closed_at AS "closedAt",
         o.created_at AS "createdAt",
         o.updated_at AS "updatedAt"
  FROM orders o
  LEFT JOIN dining_tables t ON t.id = o.table_id`

const ITEM_SELECT = `
  SELECT id, order_id AS "orderId", menu_item_id AS "menuItemId",
         name_snapshot AS "name", unit_price_cents AS "unitPriceCents",
         quantity, notes, station, status,
         created_at AS "createdAt"
  FROM order_items`

async function loadOrders(db: Db, orders: any[]) {
  if (!orders.length) return []
  const ids = orders.map((order) => order.id)
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ')
  const { rows: items } = await db.query(
    `${ITEM_SELECT} WHERE order_id IN (${placeholders}) ORDER BY created_at, id`,
    ids,
  )
  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const list = grouped.get(item.orderId) ?? []
    list.push(item)
    grouped.set(item.orderId, list)
  }
  return orders.map((order) => {
    const orderItems = grouped.get(order.id) ?? []
    return {
      ...order,
      items: orderItems,
      totalCents: orderItems.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0,
      ),
    }
  })
}

ordersRouter.get(
  '/',
  handler(async (req, res) => {
    const filters: string[] = []
    const values: unknown[] = []
    if (typeof req.query.date === 'string' && req.query.date) {
      values.push(req.query.date)
      filters.push(`o.business_date = $${values.length}`)
    }
    if (typeof req.query.status === 'string' && req.query.status) {
      values.push(req.query.status)
      filters.push(`o.status = $${values.length}`)
    }
    if (typeof req.query.open === 'string') {
      filters.push(`o.status IN ('open', 'sent', 'served')`)
    }
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
    const db = await getDb()
    const { rows } = await db.query(
      `${ORDER_SELECT}${where} ORDER BY o.created_at DESC LIMIT 200`,
      values,
    )
    res.json(await loadOrders(db, rows))
  }),
)

ordersRouter.get(
  '/:id',
  handler(async (req, res) => {
    const db = await getDb()
    const { rows } = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [param(req, 'id')])
    if (!rows.length) throw notFound('Order')
    const [order] = await loadOrders(db, rows)
    res.json(order)
  }),
)

ordersRouter.post(
  '/',
  handler(async (req, res) => {
    const input = parse(orderSchema, req.body)
    const db = await getDb()

    const order = await db.transaction(async (tx) => {
      const businessDate = input.businessDate ?? todayISO()
      const orderCode = await nextOrderCode(tx, businessDate)
      const id = randomUUID()

      await tx.query(
        `INSERT INTO orders (id, order_code, business_date, table_id, type, status, guests, notes)
         VALUES ($1, $2, $3, $4, $5, 'open', $6, $7)`,
        [
          id,
          orderCode,
          businessDate,
          input.tableId ?? null,
          input.type ?? 'dine_in',
          input.guests ?? 1,
          input.notes ?? '',
        ],
      )

      for (const line of input.items ?? []) {
        const menuItem = line.menuItemId
          ? await tx.query<{ name: string; price_cents: number; station: string }>(
              `SELECT name, price_cents, station FROM menu_items WHERE id = $1`,
              [line.menuItemId],
            )
          : null

        const name = line.name ?? menuItem?.rows[0]?.name
        if (!name) throw new HttpError(422, 'Each order item needs a name or a valid menu item')

        await tx.query(
          `INSERT INTO order_items
             (id, order_id, menu_item_id, name_snapshot, unit_price_cents,
              quantity, notes, station, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
          [
            randomUUID(),
            id,
            line.menuItemId ?? null,
            name,
            line.unitPriceCents ?? menuItem?.rows[0]?.price_cents ?? 0,
            line.quantity ?? 1,
            line.notes ?? '',
            line.station ?? menuItem?.rows[0]?.station ?? 'kitchen',
          ],
        )
      }

      return id
    })

    if (input.tableId) {
      await db.query(
        `UPDATE dining_tables SET status = 'seated', updated_at = now() WHERE id = $1`,
        [input.tableId],
      )
    }

    const created = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [order])
    const [full] = await loadOrders(db, created.rows)
    res.status(201).json(full)
  }),
)

ordersRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const input = parse(orderPatchSchema, req.body)
    const { assignments, values } = buildUpdate(input, columns)
    if (!assignments.length) return res.status(400).json({ error: 'Nothing to update' })

    const db = await getDb()
    const closing = input.status === 'paid' || input.status === 'cancelled'
    const result = await db.query(
      `UPDATE orders
       SET ${assignments.join(', ')}, updated_at = now()
           ${closing ? ', closed_at = now()' : ''}
       WHERE id = $${values.length + 1}`,
      [...values, param(req, 'id')],
    )
    if (!result.rowCount) throw notFound('Order')

    if (closing) {
      await db.query(
        `UPDATE dining_tables SET status = 'dirty', updated_at = now()
         WHERE id = (SELECT table_id FROM orders WHERE id = $1)`,
        [param(req, 'id')],
      )
    }

    const updated = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [param(req, 'id')])
    const [full] = await loadOrders(db, updated.rows)
    res.json(full)
  }),
)

ordersRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query('DELETE FROM orders WHERE id = $1', [param(req, 'id')])
    if (!result.rowCount) throw notFound('Order')
    res.status(204).end()
  }),
)

ordersRouter.post(
  '/:id/items',
  handler(async (req, res) => {
    const input = parse(orderItemSchema, req.body)
    const db = await getDb()

    const order = await db.query<{ business_date: string; status: string }>(
      `SELECT business_date::text AS business_date, status FROM orders WHERE id = $1`,
      [param(req, 'id')],
    )
    if (!order.rowCount) throw notFound('Order')
    if (['paid', 'cancelled'].includes(order.rows[0]!.status)) {
      throw new HttpError(409, 'Cannot add items to a closed order')
    }

    const menuItem = input.menuItemId
      ? await db.query<{ name: string; price_cents: number; station: string }>(
          `SELECT name, price_cents, station FROM menu_items WHERE id = $1`,
          [input.menuItemId],
        )
      : null

    const name = input.name ?? menuItem?.rows[0]?.name
    if (!name) throw new HttpError(422, 'Item needs a name or a valid menu item')

    await db.query(
      `INSERT INTO order_items
         (id, order_id, menu_item_id, name_snapshot, unit_price_cents,
          quantity, notes, station, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
      [
        randomUUID(),
        param(req, 'id'),
        input.menuItemId ?? null,
        name,
        input.unitPriceCents ?? menuItem?.rows[0]?.price_cents ?? 0,
        input.quantity ?? 1,
        input.notes ?? '',
        input.station ?? menuItem?.rows[0]?.station ?? 'kitchen',
      ],
    )

    const updated = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [param(req, 'id')])
    const [full] = await loadOrders(db, updated.rows)
    res.status(201).json(full)
  }),
)

ordersRouter.patch(
  '/:id/items/:itemId',
  handler(async (req, res) => {
    const input = parse(orderItemPatchSchema, req.body)
    const columnsMap = {
      quantity: 'quantity',
      notes: 'notes',
      status: 'status',
      station: 'station',
      unitPriceCents: 'unit_price_cents',
    }
    const { assignments, values } = buildUpdate(input as Record<string, unknown>, columnsMap)
    if (!assignments.length) return res.status(400).json({ error: 'Nothing to update' })
    const db = await getDb()
    const result = await db.query(
      `UPDATE order_items SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1} AND order_id = $${values.length + 2}`,
      [...values, param(req, 'itemId'), param(req, 'id')],
    )
    if (!result.rowCount) throw notFound('Order item')
    const updated = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [param(req, 'id')])
    const [full] = await loadOrders(db, updated.rows)
    res.json(full)
  }),
)

ordersRouter.delete(
  '/:id/items/:itemId',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query(
      `DELETE FROM order_items WHERE id = $1 AND order_id = $2 AND status = 'pending'`,
      [param(req, 'itemId'), param(req, 'id')],
    )
    if (!result.rowCount) throw new HttpError(409, 'Only pending items can be removed')
    const updated = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [param(req, 'id')])
    const [full] = await loadOrders(db, updated.rows)
    res.json(full)
  }),
)

ordersRouter.post(
  '/:id/send-to-kitchen',
  handler(async (req, res) => {
    const db = await getDb()
    const tickets = await db.transaction((tx) => fireOrderToKitchen(tx, param(req, 'id')))
    res.status(201).json({ tickets })
  }),
)

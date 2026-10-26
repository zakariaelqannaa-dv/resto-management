import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import type { Db } from '../db.js'
import { getDb } from '../db.js'
import { HttpError, handler, notFound, param } from '../http.js'
import { buildUpdate } from '../lib/sql.js'
import { todayISO } from '../lib/codes.js'
import { getKitchenPrefix, getSettings, nextTicketIdentity } from '../lib/sequence.js'
import {
  parse,
  ticketItemPatchSchema,
  ticketItemSchema,
  ticketPatchSchema,
  ticketSchema,
} from '../schemas.js'

export const kitchenRouter = Router()

const ticketColumns = {
  businessDate: 'business_date',
  ticketCode: 'ticket_code',
  orderId: 'order_id',
  station: 'station',
  status: 'status',
  priority: 'priority',
  notes: 'notes',
}

const TICKET_SELECT = `
  SELECT k.id,
         k.business_date::text AS "businessDate",
         k.seq,
         k.ticket_code AS "ticketCode",
         k.order_id AS "orderId",
         o.order_code AS "orderCode",
         k.station,
         k.status,
         k.priority,
         k.notes,
         k.fired_at AS "firedAt",
         k.ready_at AS "readyAt",
         k.served_at AS "servedAt",
         k.created_at AS "createdAt",
         k.updated_at AS "updatedAt"
  FROM kitchen_tickets k
  LEFT JOIN orders o ON o.id = k.order_id`

const TICKET_ITEM_SELECT = `
  SELECT i.id, i.ticket_id AS "ticketId", i.order_item_id AS "orderItemId",
         i.name, i.quantity, i.notes, i.done, i.sort_order AS "sortOrder",
         i.created_at AS "createdAt", i.updated_at AS "updatedAt"
  FROM kitchen_ticket_items i`

async function loadTickets(db: Db, tickets: any[]) {
  if (!tickets.length) return []
  const ids = tickets.map((ticket) => ticket.id)
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ')
  const { rows: items } = await db.query(
    `${TICKET_ITEM_SELECT} WHERE i.ticket_id IN (${placeholders}) ORDER BY i.sort_order, i.created_at`,
    ids,
  )
  const grouped = new Map<string, any[]>()
  for (const item of items) {
    const list = grouped.get(item.ticketId) ?? []
    list.push(item)
    grouped.set(item.ticketId, list)
  }
  return tickets.map((ticket) => ({ ...ticket, items: grouped.get(ticket.id) ?? [] }))
}

async function getTicket(db: Db, id: string) {
  const { rows } = await db.query(`${TICKET_SELECT} WHERE k.id = $1`, [id])
  if (!rows.length) throw notFound('Kitchen ticket')
  const [ticket] = await loadTickets(db, rows)
  return ticket
}

const statusTimestamps: Record<string, string> = {
  ready: 'ready_at',
  served: 'served_at',
}

kitchenRouter.get(
  '/tickets',
  handler(async (req, res) => {
    const filters: string[] = []
    const values: unknown[] = []

    const date = typeof req.query.date === 'string' && req.query.date ? req.query.date : null
    if (date) {
      values.push(date)
      filters.push(`k.business_date = $${values.length}`)
    }
    if (typeof req.query.station === 'string' && req.query.station !== 'all') {
      values.push(req.query.station)
      filters.push(`k.station = $${values.length}`)
    }
    if (typeof req.query.status === 'string' && req.query.status !== 'all') {
      values.push(req.query.status)
      filters.push(`k.status = $${values.length}`)
    }
    if (req.query.open === 'true') {
      filters.push(`k.status IN ('queued', 'preparing', 'ready')`)
    }

    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
    const db = await getDb()
    const { rows } = await db.query(
      `${TICKET_SELECT}${where} ORDER BY k.priority DESC, k.fired_at DESC LIMIT 300`,
      values,
    )
    res.json(await loadTickets(db, rows))
  }),
)

kitchenRouter.get(
  '/tickets/:id',
  handler(async (req, res) => {
    const db = await getDb()
    res.json(await getTicket(db, param(req, 'id')))
  }),
)

kitchenRouter.post(
  '/tickets',
  handler(async (req, res) => {
    const input = parse(ticketSchema, req.body)
    const db = await getDb()
    const businessDate = input.businessDate ?? todayISO()

    const id = await db.transaction(async (tx) => {
      const { seq, code } = await nextTicketIdentity(tx, businessDate)
      const ticketId = randomUUID()

      await tx.query(
        `INSERT INTO kitchen_tickets
           (id, business_date, seq, ticket_code, order_id, station, status, priority, notes, fired_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())`,
        [
          ticketId,
          businessDate,
          seq,
          input.ticketCode ?? code,
          input.orderId ?? null,
          input.station ?? 'kitchen',
          input.status ?? 'queued',
          input.priority ?? 0,
          input.notes ?? '',
        ],
      )

      for (const [index, item] of (input.items ?? []).entries()) {
        await tx.query(
          `INSERT INTO kitchen_ticket_items
             (id, ticket_id, name, quantity, notes, done, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            randomUUID(),
            ticketId,
            item.name,
            item.quantity ?? 1,
            item.notes ?? '',
            item.done ?? false,
            item.sortOrder ?? index,
          ],
        )
      }

      return ticketId
    })

    res.status(201).json(await getTicket(db, id))
  }),
)

kitchenRouter.patch(
  '/tickets/:id',
  handler(async (req, res) => {
    const input = parse(ticketPatchSchema, req.body)
    const db = await getDb()
    const { rows: currentRows } = await db.query<{ business_date: string; seq: number }>(
      `SELECT business_date::text AS business_date, seq FROM kitchen_tickets WHERE id = $1`,
      [param(req, 'id')],
    )
    if (!currentRows.length) throw notFound('Kitchen ticket')
    const current = currentRows[0]!

    const { assignments, values } = buildUpdate(input, ticketColumns)
    const extra: string[] = []

    // Moving a ticket to another business date needs a fresh day-scoped sequence,
    // otherwise (business_date, seq) would collide with an existing ticket.
    if (input.businessDate && input.businessDate !== current.business_date) {
      const { seq, code } = await nextTicketIdentity(db, input.businessDate)
      if (!input.ticketCode) {
        values.push(code)
        extra.push(`ticket_code = $${values.length}`)
      }
      values.push(seq)
      extra.push(`seq = $${values.length}`)
    }

    if (!assignments.length && !extra.length) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const timestampColumn = input.status ? statusTimestamps[input.status] : undefined
    if (timestampColumn) extra.push(`${timestampColumn} = now()`)

    const result = await db.query(
      `UPDATE kitchen_tickets
       SET ${[...assignments, ...extra].join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1}`,
      [...values, param(req, 'id')],
    )
    if (!result.rowCount) throw notFound('Kitchen ticket')

    if (input.status) {
      const orderStatus =
        input.status === 'preparing' ? 'preparing'
        : input.status === 'ready' ? 'ready'
        : input.status === 'served' ? 'served'
        : null
      if (orderStatus) {
        await db.query(
          `UPDATE order_items SET status = $1, updated_at = now()
           WHERE id IN (SELECT order_item_id FROM kitchen_ticket_items
                        WHERE ticket_id = $2 AND order_item_id IS NOT NULL)`,
          [orderStatus, param(req, 'id')],
        )
      }
    }

    res.json(await getTicket(db, param(req, 'id')))
  }),
)

kitchenRouter.delete(
  '/tickets/:id',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query('DELETE FROM kitchen_tickets WHERE id = $1', [param(req, 'id')])
    if (!result.rowCount) throw notFound('Kitchen ticket')
    res.status(204).end()
  }),
)

kitchenRouter.post(
  '/tickets/:id/items',
  handler(async (req, res) => {
    const input = parse(ticketItemSchema, req.body)
    const db = await getDb()
    const ticket = await db.query<{ exists: number }>(
      `SELECT 1 AS exists FROM kitchen_tickets WHERE id = $1`,
      [param(req, 'id')],
    )
    if (!ticket.rowCount) throw notFound('Kitchen ticket')

    const existing = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM kitchen_ticket_items WHERE ticket_id = $1`,
      [param(req, 'id')],
    )

    await db.query(
      `INSERT INTO kitchen_ticket_items (id, ticket_id, name, quantity, notes, done, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        param(req, 'id'),
        input.name,
        input.quantity ?? 1,
        input.notes ?? '',
        input.done ?? false,
        input.sortOrder ?? Number(existing.rows[0]?.count ?? 0),
      ],
    )
    res.status(201).json(await getTicket(db, param(req, 'id')))
  }),
)

kitchenRouter.patch(
  '/tickets/:id/items/:itemId',
  handler(async (req, res) => {
    const input = parse(ticketItemPatchSchema, req.body)
    const { assignments, values } = buildUpdate(input, {
      name: 'name',
      quantity: 'quantity',
      notes: 'notes',
      done: 'done',
      sortOrder: 'sort_order',
    })
    if (!assignments.length) return res.status(400).json({ error: 'Nothing to update' })
    const db = await getDb()
    const result = await db.query(
      `UPDATE kitchen_ticket_items
       SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1} AND ticket_id = $${values.length + 2}`,
      [...values, param(req, 'itemId'), param(req, 'id')],
    )
    if (!result.rowCount) throw notFound('Ticket item')
    res.json(await getTicket(db, param(req, 'id')))
  }),
)

kitchenRouter.delete(
  '/tickets/:id/items/:itemId',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query(
      `DELETE FROM kitchen_ticket_items WHERE id = $1 AND ticket_id = $2`,
      [param(req, 'itemId'), param(req, 'id')],
    )
    if (!result.rowCount) throw notFound('Ticket item')
    res.json(await getTicket(db, param(req, 'id')))
  }),
)

kitchenRouter.get(
  '/settings',
  handler(async (_req, res) => {
    const db = await getDb()
    res.json(await getSettings(db))
  }),
)

kitchenRouter.patch(
  '/settings',
  handler(async (req, res) => {
    const body = req.body ?? {}
    const prefix = typeof body?.kitchen?.prefix === 'string' ? body.kitchen.prefix.trim() : null
    if (prefix !== null && !/^[A-Za-z]{1,6}$/.test(prefix)) {
      throw new HttpError(422, 'Kitchen prefix must be 1-6 letters')
    }
    const db = await getDb()
    if (prefix !== null) {
      await db.query(
        `INSERT INTO settings (key, value) VALUES ('kitchen', $1)
         ON CONFLICT (key) DO UPDATE SET value = settings.value || $1`,
        [JSON.stringify({ prefix })],
      )
    }
    res.json(await getSettings(db))
  }),
)

kitchenRouter.get(
  '/next-code',
  handler(async (req, res) => {
    const db = await getDb()
    const businessDate = typeof req.query.date === 'string' && req.query.date ? req.query.date : todayISO()
    const prefix = await getKitchenPrefix(db)
    const { rows } = await db.query<{ last_seq: number }>(
      `SELECT last_seq FROM code_sequences WHERE scope = 'kitchen_ticket' AND business_date = $1`,
      [businessDate],
    )
    const next = (rows[0]?.last_seq ?? 0) + 1
    res.json({
      businessDate,
      prefix,
      nextSeq: next,
      preview: `${prefix}-${businessDate.slice(2).replace(/-/g, '')}-${String(next).padStart(3, '0')}`,
    })
  }),
)

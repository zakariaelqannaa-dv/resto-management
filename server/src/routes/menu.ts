import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db.js'
import { handler, notFound } from '../http.js'
import { buildUpdate } from '../lib/sql.js'
import { categorySchema, menuItemSchema, parse } from '../schemas.js'

export const menuRouter = Router()

const categoryColumns = { name: 'name', sortOrder: 'sort_order', active: 'active' }
const itemColumns = {
  categoryId: 'category_id',
  name: 'name',
  description: 'description',
  priceCents: 'price_cents',
  station: 'station',
  available: 'available',
  sortOrder: 'sort_order',
}

const CATEGORY_SELECT = `
  SELECT id, name, sort_order AS "sortOrder", active,
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM menu_categories`

const ITEM_SELECT = `
  SELECT id, category_id AS "categoryId", name, description,
         price_cents AS "priceCents", station, available,
         sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"
  FROM menu_items`

menuRouter.get(
  '/categories',
  handler(async (_req, res) => {
    const db = await getDb()
    const { rows } = await db.query(`${CATEGORY_SELECT} ORDER BY sort_order, name`)
    res.json(rows)
  }),
)

menuRouter.post(
  '/categories',
  handler(async (req, res) => {
    const input = parse(categorySchema, req.body)
    const db = await getDb()
    const { rows } = await db.query(
      `INSERT INTO menu_categories (id, name, sort_order, active)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [randomUUID(), input.name, input.sortOrder ?? 0, input.active ?? true],
    )
    const created = await db.query(
      `${CATEGORY_SELECT} WHERE id = $1`,
      [rows[0]!.id],
    )
    res.status(201).json(created.rows[0])
  }),
)

menuRouter.patch(
  '/categories/:id',
  handler(async (req, res) => {
    const input = parse(categorySchema.partial(), req.body)
    const { assignments, values } = buildUpdate(input, categoryColumns)
    if (!assignments.length) return res.status(400).json({ error: 'Nothing to update' })
    const db = await getDb()
    const result = await db.query(
      `UPDATE menu_categories SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1}`,
      [...values, req.params.id],
    )
    if (!result.rowCount) throw notFound('Category')
    const updated = await db.query(`${CATEGORY_SELECT} WHERE id = $1`, [req.params.id])
    res.json(updated.rows[0])
  }),
)

menuRouter.delete(
  '/categories/:id',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query('DELETE FROM menu_categories WHERE id = $1', [req.params.id])
    if (!result.rowCount) throw notFound('Category')
    res.status(204).end()
  }),
)

menuRouter.get(
  '/items',
  handler(async (req, res) => {
    const filters: string[] = []
    const values: unknown[] = []
    if (typeof req.query.categoryId === 'string') {
      values.push(req.query.categoryId)
      filters.push(`category_id = $${values.length}`)
    }
    if (typeof req.query.station === 'string') {
      values.push(req.query.station)
      filters.push(`station = $${values.length}`)
    }
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
    const db = await getDb()
    const { rows } = await db.query(
      `${ITEM_SELECT}${where} ORDER BY sort_order, name`,
      values,
    )
    res.json(rows)
  }),
)

menuRouter.post(
  '/items',
  handler(async (req, res) => {
    const input = parse(menuItemSchema, req.body)
    const db = await getDb()
    const { rows } = await db.query(
      `INSERT INTO menu_items
         (id, category_id, name, description, price_cents, station, available, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        randomUUID(),
        input.categoryId ?? null,
        input.name,
        input.description ?? '',
        input.priceCents ?? 0,
        input.station ?? 'kitchen',
        input.available ?? true,
        input.sortOrder ?? 0,
      ],
    )
    const created = await db.query(`${ITEM_SELECT} WHERE id = $1`, [rows[0]!.id])
    res.status(201).json(created.rows[0])
  }),
)

menuRouter.patch(
  '/items/:id',
  handler(async (req, res) => {
    const input = parse(menuItemSchema.partial(), req.body)
    const { assignments, values } = buildUpdate(input, itemColumns)
    if (!assignments.length) return res.status(400).json({ error: 'Nothing to update' })
    const db = await getDb()
    const result = await db.query(
      `UPDATE menu_items SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1}`,
      [...values, req.params.id],
    )
    if (!result.rowCount) throw notFound('Menu item')
    const updated = await db.query(`${ITEM_SELECT} WHERE id = $1`, [req.params.id])
    res.json(updated.rows[0])
  }),
)

menuRouter.delete(
  '/items/:id',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query('DELETE FROM menu_items WHERE id = $1', [req.params.id])
    if (!result.rowCount) throw notFound('Menu item')
    res.status(204).end()
  }),
)

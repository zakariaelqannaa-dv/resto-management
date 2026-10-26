import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db.js'
import { handler, notFound } from '../http.js'
import { buildUpdate } from '../lib/sql.js'
import { inventorySchema, parse } from '../schemas.js'

export const inventoryRouter = Router()

const columns = { name: 'name', unit: 'unit', quantity: 'quantity', reorderAt: 'reorder_at' }

const SELECT = `
  SELECT id, name, unit, quantity::float8 AS quantity, reorder_at::float8 AS "reorderAt",
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM inventory_items`

inventoryRouter.get(
  '/',
  handler(async (_req, res) => {
    const db = await getDb()
    const { rows } = await db.query(`${SELECT} ORDER BY name`)
    res.json(rows)
  }),
)

inventoryRouter.post(
  '/',
  handler(async (req, res) => {
    const input = parse(inventorySchema, req.body)
    const db = await getDb()
    const { rows } = await db.query(
      `INSERT INTO inventory_items (id, name, unit, quantity, reorder_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [randomUUID(), input.name, input.unit ?? 'unit', input.quantity ?? 0, input.reorderAt ?? 0],
    )
    const created = await db.query(`${SELECT} WHERE id = $1`, [rows[0]!.id])
    res.status(201).json(created.rows[0])
  }),
)

inventoryRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const input = parse(inventorySchema.partial(), req.body)
    const { assignments, values } = buildUpdate(input, columns)
    if (!assignments.length) return res.status(400).json({ error: 'Nothing to update' })
    const db = await getDb()
    const result = await db.query(
      `UPDATE inventory_items SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1}`,
      [...values, req.params.id],
    )
    if (!result.rowCount) throw notFound('Inventory item')
    const updated = await db.query(`${SELECT} WHERE id = $1`, [req.params.id])
    res.json(updated.rows[0])
  }),
)

inventoryRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query('DELETE FROM inventory_items WHERE id = $1', [req.params.id])
    if (!result.rowCount) throw notFound('Inventory item')
    res.status(204).end()
  }),
)

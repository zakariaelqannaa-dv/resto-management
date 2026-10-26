import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db.js'
import { handler, notFound } from '../http.js'
import { buildUpdate } from '../lib/sql.js'
import { parse, tableSchema } from '../schemas.js'

export const tablesRouter = Router()

const columns = { label: 'label', seats: 'seats', zone: 'zone', status: 'status' }

const TABLE_SELECT = `
  SELECT id, label, seats, zone, status,
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM dining_tables`

tablesRouter.get(
  '/',
  handler(async (_req, res) => {
    const db = await getDb()
    const { rows } = await db.query(`${TABLE_SELECT} ORDER BY zone, label`)
    res.json(rows)
  }),
)

tablesRouter.post(
  '/',
  handler(async (req, res) => {
    const input = parse(tableSchema, req.body)
    const db = await getDb()
    const { rows } = await db.query(
      `INSERT INTO dining_tables (id, label, seats, zone, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        randomUUID(),
        input.label,
        input.seats ?? 2,
        input.zone ?? 'main',
        input.status ?? 'free',
      ],
    )
    const created = await db.query(`${TABLE_SELECT} WHERE id = $1`, [rows[0]!.id])
    res.status(201).json(created.rows[0])
  }),
)

tablesRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const input = parse(tableSchema.partial(), req.body)
    const { assignments, values } = buildUpdate(input, columns)
    if (!assignments.length) return res.status(400).json({ error: 'Nothing to update' })
    const db = await getDb()
    const result = await db.query(
      `UPDATE dining_tables SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length + 1}`,
      [...values, req.params.id],
    )
    if (!result.rowCount) throw notFound('Table')
    const updated = await db.query(`${TABLE_SELECT} WHERE id = $1`, [req.params.id])
    res.json(updated.rows[0])
  }),
)

tablesRouter.delete(
  '/:id',
  handler(async (req, res) => {
    const db = await getDb()
    const result = await db.query('DELETE FROM dining_tables WHERE id = $1', [req.params.id])
    if (!result.rowCount) throw notFound('Table')
    res.status(204).end()
  }),
)

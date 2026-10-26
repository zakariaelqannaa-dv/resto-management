import { Router } from 'express'
import { getDb } from '../db.js'
import { handler } from '../http.js'
import { todayISO } from '../lib/codes.js'

export const statsRouter = Router()

statsRouter.get(
  '/today',
  handler(async (req, res) => {
    const date = typeof req.query.date === 'string' && req.query.date ? req.query.date : todayISO()
    const db = await getDb()

    const [tickets, orders, revenue] = await Promise.all([
      db.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM kitchen_tickets
         WHERE business_date = $1 GROUP BY status`,
        [date],
      ),
      db.query<{ status: string; count: string; covers: string }>(
        `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(guests), 0)::text AS covers
         FROM orders WHERE business_date = $1 GROUP BY status`,
        [date],
      ),
      db.query<{ cents: string }>(
        `SELECT COALESCE(SUM(oi.unit_price_cents * oi.quantity), 0)::text AS cents
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.business_date = $1 AND o.status = 'paid'`,
        [date],
      ),
    ])

    const ticketsByStatus = Object.fromEntries(
      tickets.rows.map((row) => [row.status, Number(row.count)]),
    )
    const ordersByStatus = Object.fromEntries(
      orders.rows.map((row) => [row.status, Number(row.count)]),
    )

    res.json({
      date,
      tickets: {
        byStatus: ticketsByStatus,
        open:
          (ticketsByStatus.queued ?? 0) +
          (ticketsByStatus.preparing ?? 0) +
          (ticketsByStatus.ready ?? 0),
      },
      orders: {
        byStatus: ordersByStatus,
        open:
          (ordersByStatus.open ?? 0) + (ordersByStatus.sent ?? 0) + (ordersByStatus.served ?? 0),
        covers: orders.rows.reduce((sum, row) => sum + Number(row.covers), 0),
      },
      revenueCents: Number(revenue.rows[0]?.cents ?? 0),
    })
  }),
)

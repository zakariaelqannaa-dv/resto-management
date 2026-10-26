import { randomUUID } from 'node:crypto'
import type { Db } from '../db.js'
import { HttpError } from '../http.js'
import { nextTicketIdentity } from './sequence.js'

interface PendingItem {
  id: string
  nameSnapshot: string
  quantity: number
  notes: string
  station: string
}

/**
 * Turns every `pending` order item into a kitchen ticket, one ticket per
 * station, using the day-scoped sequence for each ticket code.
 */
export async function fireOrderToKitchen(
  db: Db,
  orderId: string,
): Promise<Array<{ id: string; station: string; ticketCode: string }>> {
  const order = await db.query<{ business_date: string }>(
    `SELECT business_date::text AS business_date FROM orders WHERE id = $1`,
    [orderId],
  )
  if (!order.rowCount) throw new HttpError(404, 'Order not found')
  const businessDate = order.rows[0]!.business_date

  const { rows: items } = await db.query<PendingItem>(
    `SELECT id, name_snapshot AS "nameSnapshot", quantity, notes, station
     FROM order_items
     WHERE order_id = $1 AND status = 'pending'
     ORDER BY created_at, id`,
    [orderId],
  )
  if (!items.length) throw new HttpError(400, 'This order has no pending items to send')

  const byStation = new Map<string, PendingItem[]>()
  for (const item of items) {
    const list = byStation.get(item.station) ?? []
    list.push(item)
    byStation.set(item.station, list)
  }

  const created: Array<{ id: string; station: string; ticketCode: string }> = []

  for (const [station, stationItems] of byStation) {
    const { seq, code } = await nextTicketIdentity(db, businessDate)
    const ticketId = randomUUID()

    await db.query(
      `INSERT INTO kitchen_tickets
         (id, business_date, seq, ticket_code, order_id, station, status, priority, fired_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued', 0, now())`,
      [ticketId, businessDate, seq, code, orderId, station],
    )

    for (const [index, item] of stationItems.entries()) {
      await db.query(
        `INSERT INTO kitchen_ticket_items
           (id, ticket_id, order_item_id, name, quantity, notes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [randomUUID(), ticketId, item.id, item.nameSnapshot, item.quantity, item.notes, index],
      )
      await db.query(
        `UPDATE order_items SET status = 'sent', updated_at = now() WHERE id = $1`,
        [item.id],
      )
    }

    created.push({ id: ticketId, station, ticketCode: code })
  }

  await db.query(
    `UPDATE orders SET status = 'sent', updated_at = now()
     WHERE id = $1 AND status = 'open'`,
    [orderId],
  )

  return created
}

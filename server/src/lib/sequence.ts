import type { Db } from '../db.js'
import { formatCode } from './codes.js'

/**
 * Atomically reserves the next number for a (scope, business date) pair.
 * `INSERT .. ON CONFLICT .. DO UPDATE .. RETURNING` keeps this safe under
 * concurrent requests without needing advisory locks (works on PGlite too).
 */
export async function nextSequence(db: Db, scope: string, businessDate: string): Promise<number> {
  const { rows } = await db.query<{ last_seq: number }>(
    `INSERT INTO code_sequences (scope, business_date, last_seq)
     VALUES ($1, $2, 1)
     ON CONFLICT (scope, business_date)
     DO UPDATE SET last_seq = code_sequences.last_seq + 1
     RETURNING last_seq`,
    [scope, businessDate],
  )
  return rows[0]!.last_seq
}

export async function nextTicketIdentity(
  db: Db,
  businessDate: string,
): Promise<{ seq: number; code: string }> {
  const prefix = await getKitchenPrefix(db)
  const seq = await nextSequence(db, 'kitchen_ticket', businessDate)
  return { seq, code: formatCode(businessDate, seq, prefix) }
}

export async function nextOrderCode(db: Db, businessDate: string): Promise<string> {
  const seq = await nextSequence(db, 'order', businessDate)
  return formatCode(businessDate, seq, 'ORD')
}

export async function getKitchenPrefix(db: Db): Promise<string> {
  const { rows } = await db.query<{ value: { prefix?: string } }>(
    `SELECT value FROM settings WHERE key = 'kitchen'`,
  )
  return rows[0]?.value?.prefix?.trim() || 'K'
}

export async function getSettings(db: Db): Promise<Record<string, any>> {
  const { rows } = await db.query<{ key: string; value: any }>('SELECT key, value FROM settings')
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

import { getDb } from '../db.js'

const db = await getDb()
console.log(`[db] migrations up to date (${db.kind})`)
await db.close()

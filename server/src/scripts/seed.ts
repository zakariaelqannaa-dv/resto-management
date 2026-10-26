import { getDb } from '../db.js'
import { seedIfEmpty } from '../lib/seed.js'

const db = await getDb()
const seeded = await seedIfEmpty(db)
console.log(
  seeded
    ? '[seed] menu, tables, staff and settings created'
    : '[seed] data already present, skipping',
)
await db.close()

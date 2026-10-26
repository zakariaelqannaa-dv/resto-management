import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../db.js'
import { config, DATA_DIR } from '../config.js'

if (config.databaseUrl) {
  console.error('[db] Refusing to reset a real Postgres database (DATABASE_URL is set).')
  process.exit(1)
}

const db = await getDb()
await db.close()
fs.rmSync(DATA_DIR, { recursive: true, force: true })
fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true })
console.log('[db] embedded database removed; run `npm run db:migrate` and `npm run db:seed`')

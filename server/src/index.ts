import { createApp, hasClientBuild } from './app.js'
import { config } from './config.js'
import { getDb } from './db.js'
import { seedIfEmpty } from './lib/seed.js'

const db = await getDb()
// First run against a brand-new database: give the user something to look at.
if (await seedIfEmpty(db)) console.log('[db] demo menu, tables and staff seeded')
const app = createApp()

const server = app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port}`)
  console.log(`[api] database: ${db.kind === 'pglite' ? 'embedded Postgres (server/.data)' : 'Postgres'}`)
  console.log(
    hasClientBuild
      ? `[api] serving the built web app at http://localhost:${config.port}`
      : `[api] web app runs separately: run "npm run dev" and open http://localhost:5173`,
  )
})

server.on('error', async (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n[api] Port ${config.port} is already in use.`)
    console.error('[api] Stop the process using it, or set PORT in .env to a free port.\n')
    await db.close()
    process.exit(1)
  }
  throw error
})

const shutdown = async () => {
  server.close()
  await db.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { PGlite } from '@electric-sql/pglite'
import { config, DATA_DIR, MIGRATIONS_DIR } from './config.js'

export type Row = Record<string, any>

export interface QueryResult<T extends Row = Row> {
  rows: T[]
  rowCount: number
}

export interface Db {
  readonly kind: 'pglite' | 'postgres'
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
  exec(sql: string): Promise<void>
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  close(): Promise<void>
}

class PgliteDb implements Db {
  readonly kind = 'pglite' as const
  constructor(private readonly db: PGlite) {}

  async query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.db.query<T>(sql, params)
    // PGlite reports affectedRows: 0 for SELECTs, so prefer the returned row count.
    const rowCount = result.rows.length > 0 ? result.rows.length : (result.affectedRows ?? 0)
    return { rows: result.rows, rowCount }
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql)
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    await this.db.exec('BEGIN')
    try {
      const result = await fn(this)
      await this.db.exec('COMMIT')
      return result
    } catch (error) {
      await this.db.exec('ROLLBACK')
      throw error
    }
  }

  async close(): Promise<void> {
    await this.db.close()
  }
}

class PgDb implements Db {
  readonly kind = 'postgres' as const
  constructor(private readonly pool: pg.Pool, private readonly client?: pg.PoolClient) {}

  private get runner(): pg.Pool | pg.PoolClient {
    return this.client ?? this.pool
  }

  async query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.runner.query(sql, params)
    return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length }
  }

  async exec(sql: string): Promise<void> {
    await this.runner.query(sql)
  }

  async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    if (this.client) return fn(this)
    const client = await this.pool.connect()
    const tx = new PgDb(this.pool, client)
    try {
      await client.query('BEGIN')
      const result = await fn(tx)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

let instance: Db | null = null

export async function getDb(): Promise<Db> {
  if (instance) return instance
  if (config.databaseUrl) {
    const pool = new pg.Pool({ connectionString: config.databaseUrl })
    instance = new PgDb(pool)
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const pglite = new PGlite(path.join(DATA_DIR, 'pg'))
    instance = new PgliteDb(pglite)
  }
  await migrate(instance)
  return instance
}

export async function migrate(db: Db): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    );
  `)

  const applied = await db.query<{ name: string }>('SELECT name FROM schema_migrations')
  const done = new Set(applied.rows.map((row) => row.name))

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (done.has(file)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    await db.transaction(async (tx) => {
      await tx.exec(sql)
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    })
    console.log(`[db] applied ${file}`)
  }
}

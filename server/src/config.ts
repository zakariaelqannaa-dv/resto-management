import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))

/** server/src -> repo root */
export const ROOT = path.resolve(here, '../..')
export const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations')
/** Overridable so the desktop build can keep data in %APPDATA% instead of the install folder. */
export const DATA_DIR = process.env.DATA_DIR?.trim() || path.join(ROOT, 'server', '.data')

function loadEnvFile() {
  const file = path.join(ROOT, '.env')
  if (!fs.existsSync(file)) return
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile()

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  isProd: process.env.NODE_ENV === 'production',
}

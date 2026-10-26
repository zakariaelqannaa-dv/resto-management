export function todayISO(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** `K-261026-007` — prefix, business date, day-scoped sequence. */
export function formatCode(dateISO: string, seq: number, prefix: string): string {
  const compact = dateISO.slice(2).replace(/-/g, '')
  return `${prefix}-${compact}-${String(seq).padStart(3, '0')}`
}

export function parseCodeDate(code: string): string | null {
  const match = /^[A-Za-z]+-(\d{2})(\d{2})(\d{2})-\d+$/.exec(code.trim())
  if (!match) return null
  const [, yy, mm, dd] = match
  const year = 2000 + Number(yy)
  const iso = `${year}-${mm}-${dd}`
  return isValidISODate(iso) ? iso : null
}

export function padSeq(seq: number, width = 3): string {
  return String(seq).padStart(width, '0')
}

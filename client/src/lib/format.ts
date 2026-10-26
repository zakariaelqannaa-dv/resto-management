export function todayISO(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function money(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  })
}

export function clock(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function dateLabel(iso: string): string {
  const [year, month, day] = iso.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function elapsed(fromIso: string): string {
  const minutes = Math.floor((Date.now() - new Date(fromIso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function minutesSince(fromIso: string): number {
  return Math.floor((Date.now() - new Date(fromIso).getTime()) / 60_000)
}

export const STATIONS = ['kitchen', 'grill', 'bar', 'dessert'] as const
export const STATION_LABEL: Record<string, string> = {
  kitchen: 'Kitchen',
  grill: 'Grill',
  bar: 'Bar',
  dessert: 'Dessert',
}
export const TICKET_STATUSES = ['queued', 'preparing', 'ready', 'served'] as const
export const TICKET_STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

export type Station = 'kitchen' | 'grill' | 'bar' | 'dessert'
export type TicketStatus = 'queued' | 'preparing' | 'ready' | 'served' | 'cancelled'
export type OrderStatus = 'open' | 'sent' | 'served' | 'paid' | 'cancelled'
export type TableStatus = 'free' | 'seated' | 'reserved' | 'dirty'

export interface KitchenTicketItem {
  id: string
  ticketId: string
  orderItemId: string | null
  name: string
  quantity: number
  notes: string
  done: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface KitchenTicket {
  id: string
  businessDate: string
  seq: number
  ticketCode: string
  orderId: string | null
  orderCode: string | null
  station: Station
  status: TicketStatus
  priority: number
  notes: string
  firedAt: string
  readyAt: string | null
  servedAt: string | null
  createdAt: string
  updatedAt: string
  items: KitchenTicketItem[]
}

export interface Category {
  id: string
  name: string
  sortOrder: number
  active: boolean
}

export interface MenuItem {
  id: string
  categoryId: string | null
  name: string
  description: string
  priceCents: number
  station: Station
  available: boolean
  sortOrder: number
}

export interface DiningTable {
  id: string
  label: string
  seats: number
  zone: string
  status: TableStatus
}

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string | null
  name: string
  unitPriceCents: number
  quantity: number
  notes: string
  station: Station
  status: string
}

export interface Order {
  id: string
  orderCode: string
  businessDate: string
  tableId: string | null
  tableLabel: string | null
  type: 'dine_in' | 'takeaway' | 'delivery'
  status: OrderStatus
  guests: number
  notes: string
  openedAt: string
  closedAt: string | null
  totalCents: number
  items: OrderItem[]
}

export interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  reorderAt: number
}

export interface Stats {
  date: string
  tickets: { byStatus: Record<string, number>; open: number }
  orders: { byStatus: Record<string, number>; open: number; covers: number }
  revenueCents: number
}

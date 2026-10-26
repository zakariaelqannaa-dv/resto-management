import { z } from 'zod'
import { isValidISODate } from './lib/codes.js'
import { HttpError } from './http.js'

const isoDate = z
  .string()
  .refine(isValidISODate, { message: 'Expected a real date in YYYY-MM-DD format' })

const station = z.enum(['kitchen', 'grill', 'bar', 'dessert'])
const ticketStatus = z.enum(['queued', 'preparing', 'ready', 'served', 'cancelled'])

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
})

export const menuItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(0).max(10_000_000).optional(),
  station: station.optional(),
  available: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const tableSchema = z.object({
  label: z.string().trim().min(1).max(40),
  seats: z.number().int().min(1).max(50).optional(),
  zone: z.string().trim().max(40).optional(),
  status: z.enum(['free', 'seated', 'reserved', 'dirty']).optional(),
})

export const orderItemSchema = z.object({
  menuItemId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  unitPriceCents: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(300).optional(),
  station: station.optional(),
})

export const orderItemPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  unitPriceCents: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(300).optional(),
  station: station.optional(),
  status: z.enum(['pending', 'sent', 'preparing', 'ready', 'served', 'void']).optional(),
})

export const ticketItemPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(300).optional(),
  done: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const orderSchema = z.object({
  tableId: z.string().uuid().nullable().optional(),
  type: z.enum(['dine_in', 'takeaway', 'delivery']).optional(),
  guests: z.number().int().min(0).max(50).optional(),
  notes: z.string().max(500).optional(),
  businessDate: isoDate.optional(),
  items: z.array(orderItemSchema).max(100).optional(),
})

export const orderPatchSchema = z.object({
  tableId: z.string().uuid().nullable().optional(),
  type: z.enum(['dine_in', 'takeaway', 'delivery']).optional(),
  guests: z.number().int().min(0).max(50).optional(),
  notes: z.string().max(500).optional(),
  businessDate: isoDate.optional(),
  status: z.enum(['open', 'sent', 'served', 'paid', 'cancelled']).optional(),
})

export const ticketItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(300).optional(),
  done: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const ticketSchema = z.object({
  businessDate: isoDate.optional(),
  ticketCode: z.string().trim().min(1).max(40).optional(),
  orderId: z.string().uuid().nullable().optional(),
  station: station.optional(),
  status: ticketStatus.optional(),
  priority: z.number().int().min(0).max(2).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(ticketItemSchema).max(100).optional(),
})

export const ticketPatchSchema = ticketSchema.partial()

export const inventorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().max(20).optional(),
  quantity: z.number().min(0).optional(),
  reorderAt: z.number().min(0).optional(),
})

export function parse<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.infer<T> {
  const result = schema.safeParse(payload ?? {})
  if (!result.success) {
    throw new HttpError(422, 'Validation failed', result.error.flatten())
  }
  return result.data
}

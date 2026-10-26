import type { Db } from '../db.js'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const categories = [
  [id(1), 'Starters', 1],
  [id(2), 'Mains', 2],
  [id(3), 'Grill', 3],
  [id(4), 'Desserts', 4],
  [id(5), 'Drinks', 5],
] as const

const items = [
  [id(101), id(1), 'Bruschetta', 'Tomato, basil, garlic on toast', 650, 'kitchen', true, 1],
  [id(102), id(1), 'Calamari', 'Lemon aioli', 890, 'kitchen', true, 2],
  [id(103), id(1), 'Soup of the day', 'Ask the kitchen', 550, 'kitchen', true, 3],
  [id(201), id(2), 'Margherita', 'San Marzano, mozzarella, basil', 1150, 'kitchen', true, 1],
  [id(202), id(2), 'Carbonara', 'Guanciale, pecorino, egg yolk', 1390, 'kitchen', true, 2],
  [id(203), id(2), 'Risotto ai funghi', 'Porcini, parmesan', 1450, 'kitchen', true, 3],
  [id(301), id(3), 'Ribeye 300g', 'Grass fed, herb butter', 2890, 'grill', true, 1],
  [id(302), id(3), 'Grilled sea bass', 'Fennel salad', 2250, 'grill', true, 2],
  [id(303), id(3), 'Chicken skewers', 'Smoked paprika', 1690, 'grill', true, 3],
  [id(401), id(4), 'Tiramisu', 'Classic, made daily', 790, 'dessert', true, 1],
  [id(402), id(4), 'Panna cotta', 'Berry compote', 690, 'dessert', true, 2],
  [id(501), id(5), 'House red (glass)', 'Sangiovese', 550, 'bar', true, 1],
  [id(502), id(5), 'Lemonade', 'Fresh squeezed', 350, 'bar', true, 2],
  [id(503), id(5), 'Espresso', 'Single origin', 280, 'bar', true, 3],
] as const

const tables = [
  [id(601), 'T1', 2, 'main', 'free'],
  [id(602), 'T2', 2, 'main', 'free'],
  [id(603), 'T3', 4, 'main', 'free'],
  [id(604), 'T4', 4, 'main', 'free'],
  [id(605), 'T5', 6, 'main', 'free'],
  [id(606), 'T6', 2, 'terrace', 'free'],
  [id(607), 'T7', 4, 'terrace', 'free'],
  [id(608), 'T8', 8, 'terrace', 'free'],
] as const

const staff = [
  [id(701), 'Marta Ruiz', 'manager'],
  [id(702), 'Luca Bianchi', 'waiter'],
  [id(703), 'Aiko Tanaka', 'kitchen'],
  [id(704), 'Sam Okafor', 'cashier'],
] as const

/**
 * Fills an empty database with a demo menu, floor and staff.
 * Existing rows are never touched, so this is safe to call on every start.
 * Returns true when data was inserted.
 */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  const existing = await db.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM menu_items',
  )
  if (Number(existing.rows[0]?.count ?? 0) > 0) return false

  await db.transaction(async (tx) => {
    for (const [categoryId, name, sortOrder] of categories) {
      await tx.query(
        `INSERT INTO menu_categories (id, name, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [categoryId, name, sortOrder],
      )
    }

    for (const [itemId, categoryId, name, description, price, station, available, sortOrder] of items) {
      await tx.query(
        `INSERT INTO menu_items
           (id, category_id, name, description, price_cents, station, available, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [itemId, categoryId, name, description, price, station, available, sortOrder],
      )
    }

    for (const [tableId, label, seats, zone, status] of tables) {
      await tx.query(
        `INSERT INTO dining_tables (id, label, seats, zone, status) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [tableId, label, seats, zone, status],
      )
    }

    for (const [staffId, name, role] of staff) {
      await tx.query(
        `INSERT INTO staff (id, name, role) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [staffId, name, role],
      )
    }

    await tx.query(
      `INSERT INTO settings (key, value) VALUES ('kitchen', $1)
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify({ prefix: 'K' })],
    )
  })

  return true
}

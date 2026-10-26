-- Core schema. Portable between PGlite (embedded dev) and a real Postgres server.

CREATE TABLE IF NOT EXISTS staff (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  role        text NOT NULL CHECK (role IN ('manager', 'waiter', 'kitchen', 'cashier')),
  pin         text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_categories (
  id          uuid PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           uuid PRIMARY KEY,
  category_id  uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  price_cents  integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  station      text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'grill', 'bar', 'dessert')),
  available    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dining_tables (
  id          uuid PRIMARY KEY,
  label       text NOT NULL UNIQUE,
  seats       integer NOT NULL DEFAULT 2 CHECK (seats > 0),
  zone        text NOT NULL DEFAULT 'main',
  status      text NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'seated', 'reserved', 'dirty')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id           uuid PRIMARY KEY,
  order_code   text NOT NULL UNIQUE,
  business_date date NOT NULL,
  table_id     uuid REFERENCES dining_tables(id) ON DELETE SET NULL,
  type         text NOT NULL DEFAULT 'dine_in' CHECK (type IN ('dine_in', 'takeaway', 'delivery')),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sent', 'served', 'paid', 'cancelled')),
  guests       integer NOT NULL DEFAULT 1 CHECK (guests >= 0),
  notes        text NOT NULL DEFAULT '',
  opened_at    timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id               uuid PRIMARY KEY,
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id     uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  name_snapshot    text NOT NULL,
  unit_price_cents integer NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  quantity         integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes            text NOT NULL DEFAULT '',
  station          text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'grill', 'bar', 'dessert')),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'preparing', 'ready', 'served', 'void')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Day-scoped counters used to build human readable codes (orders, kitchen tickets).
CREATE TABLE IF NOT EXISTS code_sequences (
  scope         text NOT NULL,
  business_date date NOT NULL,
  last_seq      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, business_date)
);

CREATE TABLE IF NOT EXISTS kitchen_tickets (
  id            uuid PRIMARY KEY,
  business_date date NOT NULL,
  seq           integer NOT NULL,
  ticket_code   text NOT NULL,
  order_id      uuid REFERENCES orders(id) ON DELETE SET NULL,
  station       text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'grill', 'bar', 'dessert')),
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preparing', 'ready', 'served', 'cancelled')),
  priority      smallint NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 2),
  notes         text NOT NULL DEFAULT '',
  fired_at      timestamptz NOT NULL DEFAULT now(),
  ready_at      timestamptz,
  served_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_date, seq),
  UNIQUE (ticket_code)
);

CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
  id            uuid PRIMARY KEY,
  ticket_id     uuid NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  name          text NOT NULL,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes         text NOT NULL DEFAULT '',
  done          boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  unit        text NOT NULL DEFAULT 'unit',
  quantity    numeric(12, 2) NOT NULL DEFAULT 0,
  reorder_at  numeric(12, 2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_date ON kitchen_tickets (business_date, station, status);
CREATE INDEX IF NOT EXISTS idx_kitchen_ticket_items_ticket ON kitchen_ticket_items (ticket_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (business_date, status);

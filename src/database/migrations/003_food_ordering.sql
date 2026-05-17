-- Food & beverage ordering: service type, menu items, orders

DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('content', 'food_order');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS service_type service_type NOT NULL DEFAULT 'content';

DO $$ BEGIN
  CREATE TYPE menu_category AS ENUM ('food', 'drink');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE food_order_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS menu_items (
  id BIGSERIAL PRIMARY KEY,
  hotel_id BIGINT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category menu_category NOT NULL DEFAULT 'food',
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  description TEXT,
  description_en TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_hotel ON menu_items(hotel_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_hotel_available ON menu_items(hotel_id, is_available)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS food_orders (
  id BIGSERIAL PRIMARY KEY,
  hotel_id BIGINT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  room_number VARCHAR(50),
  customer_name VARCHAR(120),
  customer_phone VARCHAR(50),
  note TEXT,
  status food_order_status NOT NULL DEFAULT 'PENDING',
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_orders_hotel_status ON food_orders(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_food_orders_created ON food_orders(hotel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS food_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES food_orders(id) ON DELETE CASCADE,
  menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name VARCHAR(200) NOT NULL,
  category menu_category NOT NULL DEFAULT 'food',
  unit_price NUMERIC(12, 2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_food_order_items_order ON food_order_items(order_id);

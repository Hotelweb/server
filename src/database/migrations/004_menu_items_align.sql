-- Align legacy menu_items (seed: category_id + translations) with food-order module.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category menu_category;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name_en VARCHAR(200);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description_en TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- Backfill from menu_item_translations when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_item_translations'
  ) THEN
    UPDATE menu_items mi
    SET name = t.name
    FROM menu_item_translations t
    WHERE mi.id = t.menu_item_id
      AND t.language = 'vi'
      AND (mi.name IS NULL OR mi.name = '');

    UPDATE menu_items mi
    SET name_en = t.name
    FROM menu_item_translations t
    WHERE mi.id = t.menu_item_id
      AND t.language = 'en'
      AND mi.name_en IS NULL;

    UPDATE menu_items mi
    SET description = t.description
    FROM menu_item_translations t
    WHERE mi.id = t.menu_item_id
      AND t.language = 'vi'
      AND mi.description IS NULL
      AND t.description IS NOT NULL;

    UPDATE menu_items mi
    SET description_en = t.description
    FROM menu_item_translations t
    WHERE mi.id = t.menu_item_id
      AND t.language = 'en'
      AND mi.description_en IS NULL
      AND t.description IS NOT NULL;
  END IF;
END $$;

-- Map drink vs food from category translation names when category_id exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'category_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_category_translations'
  ) THEN
    UPDATE menu_items mi
    SET category = 'drink'
    WHERE mi.category IS NULL
      AND EXISTS (
        SELECT 1 FROM menu_category_translations mct
        WHERE mct.category_id = mi.category_id
          AND (
            lower(mct.name) LIKE '%uống%'
            OR lower(mct.name) LIKE '%drink%'
            OR lower(mct.name) LIKE '%beverage%'
            OR lower(mct.name) LIKE '%coffee%'
            OR lower(mct.name) LIKE '%tea%'
          )
      );
  END IF;
END $$;

UPDATE menu_items SET category = 'food' WHERE category IS NULL;

UPDATE menu_items
SET name = 'Món #' || id::text
WHERE name IS NULL OR trim(name) = '';

ALTER TABLE menu_items ALTER COLUMN category SET DEFAULT 'food';

UPDATE menu_items SET category = 'food' WHERE category IS NULL;

ALTER TABLE menu_items ALTER COLUMN category SET NOT NULL;

ALTER TABLE menu_items ALTER COLUMN name SET NOT NULL;

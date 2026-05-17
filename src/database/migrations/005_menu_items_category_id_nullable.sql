-- Legacy seed schema requires category_id; food-order module uses category enum instead.
-- Allow inserts that only set category (food/drink) without menu_categories row.

ALTER TABLE menu_items ALTER COLUMN category_id DROP NOT NULL;

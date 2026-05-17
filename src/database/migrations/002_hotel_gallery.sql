-- ============================================================================
-- Migration: hotel gallery (Cloudinary-hosted intro photos)
--
-- Adds an array column on hotels for the additional photos displayed on the
-- customer-facing hotel detail page. Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS gallery TEXT[] NOT NULL DEFAULT '{}';

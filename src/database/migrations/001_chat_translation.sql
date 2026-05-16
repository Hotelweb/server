-- ============================================================================
-- Migration: chat translation pipeline + booking session fields
--
-- Safely upgrades an existing schema in place. Idempotent — re-running is OK.
--
-- Applies:
--   1. Adds 'th' to language_code, 'BOOKED' to chat_session_status
--   2. Creates new translation_status / message_status enums
--   3. Adds new columns on customer_sessions and chat_messages
--   4. Backfills sensible defaults so the chat keeps working
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend existing enums (must run OUTSIDE a transaction block on Postgres
--    versions where ADD VALUE is restricted). Each statement is independent.
-- ----------------------------------------------------------------------------

ALTER TYPE language_code ADD VALUE IF NOT EXISTS 'th';

ALTER TYPE chat_session_status ADD VALUE IF NOT EXISTS 'BOOKED';

-- ----------------------------------------------------------------------------
-- 2. Create new enums (DO blocks ignore "already exists")
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE translation_status AS ENUM ('PENDING', 'TRANSLATED', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Add new columns to customer_sessions
-- ----------------------------------------------------------------------------

ALTER TABLE customer_sessions
  ADD COLUMN IF NOT EXISTS customer_email   varchar(255),
  ADD COLUMN IF NOT EXISTS customer_country varchar(80),
  ADD COLUMN IF NOT EXISTS room_type        varchar(80),
  ADD COLUMN IF NOT EXISTS check_in_date    date,
  ADD COLUMN IF NOT EXISTS check_out_date   date,
  ADD COLUMN IF NOT EXISTS guest_count      int,
  ADD COLUMN IF NOT EXISTS initial_request  text,
  ADD COLUMN IF NOT EXISTS unread_count     int NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 4. Add new columns to chat_messages
-- ----------------------------------------------------------------------------

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS target_language          language_code,
  ADD COLUMN IF NOT EXISTS translation_status       translation_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS translation_provider     varchar(30),
  ADD COLUMN IF NOT EXISTS translation_duration_ms  int,
  ADD COLUMN IF NOT EXISTS status                   message_status NOT NULL DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS client_message_id        varchar(80),
  ADD COLUMN IF NOT EXISTS read_at                  timestamptz;

-- ----------------------------------------------------------------------------
-- 5. Backfill: existing rows are considered already-translated/delivered
-- ----------------------------------------------------------------------------

UPDATE chat_messages
SET translation_status = 'SKIPPED'
WHERE translation_status = 'PENDING';

UPDATE chat_messages
SET status = 'DELIVERED'
WHERE status = 'SENT' AND is_read = FALSE;

UPDATE chat_messages
SET status = 'READ', read_at = COALESCE(read_at, created_at)
WHERE is_read = TRUE;

-- Migration: Add mutual cancellation fields to forumposts table
-- Run this once in Supabase SQL editor or via psycopg2 script

-- 1. Add cancellation request tracking columns
ALTER TABLE forumposts
    ADD COLUMN IF NOT EXISTS cancel_requested_by VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS cancel_request_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ NULL;

-- 2. Allow the new 'pending_cancellation' value in the status enum
--    (Only needed if the DB uses a native ENUM type; skip if it's VARCHAR)
--    The ORM uses native_enum=False so the column is stored as VARCHAR — no type change needed.
--    If your DB DOES use a native enum, run:
-- ALTER TYPE forumpost_status ADD VALUE IF NOT EXISTS 'pending_cancellation';

-- Migration: Add 'in_queue' status to ForumPost
-- Jobs that have been hired but whose start date has not yet been reached
-- will be stored with status = 'in_queue' and automatically transition to
-- 'ongoing' when the start date arrives.
--
-- The forumposts.status column uses a NATIVE PostgreSQL ENUM type named
-- 'forumpost_status'. To add a new value to a native PG ENUM, use ALTER TYPE.
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
-- Run this directly in Supabase SQL Editor or via the runner script.

ALTER TYPE forumpost_status ADD VALUE IF NOT EXISTS 'in_queue';

-- Also add 'pending_cancellation' if not already present (added earlier)
ALTER TYPE forumpost_status ADD VALUE IF NOT EXISTS 'pending_cancellation';

-- Verify:
-- SELECT enum_range(NULL::forumpost_status);

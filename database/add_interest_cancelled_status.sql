-- Add cancelled status for job applications (interestcheck.status)
-- Safe to run in Supabase SQL editor.
-- Important: PostgreSQL requires a commit after ALTER TYPE ... ADD VALUE
-- before the new enum value can be used in UPDATE statements.

-- 1) Add enum value if missing (autocommit statement)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'interest_status'
      AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE interest_status ADD VALUE 'cancelled';
  END IF;
END
$$;

-- 2) Backfill data in a separate transaction
BEGIN;

UPDATE interestcheck ic
SET status = 'cancelled'::interest_status
FROM forumposts fp
WHERE ic.post_id = fp.post_id
  AND ic.status = 'pending'::interest_status
  AND fp.status = 'cancelled'::forumpost_status;

COMMIT;

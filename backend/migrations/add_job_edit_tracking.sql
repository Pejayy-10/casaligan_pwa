-- Migration: Add job edit tracking to interestcheck table
-- This allows tracking when applicants are notified of job edits and their responses

-- Add enum type for edit response status if it doesn't exist
DO $$ BEGIN
    CREATE TYPE edit_response_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add columns to interestcheck table
ALTER TABLE interestcheck
ADD COLUMN IF NOT EXISTS edit_response edit_response_status,
ADD COLUMN IF NOT EXISTS edit_notified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edit_responded_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on edit_response
CREATE INDEX IF NOT EXISTS idx_interestcheck_edit_response ON interestcheck(edit_response) WHERE edit_response IS NOT NULL;

-- Add index for finding pending responses
CREATE INDEX IF NOT EXISTS idx_interestcheck_edit_pending ON interestcheck(post_id, edit_response) WHERE edit_response = 'pending'::edit_response_status;

-- Add comment for documentation
COMMENT ON COLUMN interestcheck.edit_response IS 'Response status when job is edited: NULL = no edit yet, pending = notified but not responded, accepted/rejected = applicant response';
COMMENT ON COLUMN interestcheck.edit_notified_at IS 'Timestamp when applicant was notified of job edit';
COMMENT ON COLUMN interestcheck.edit_responded_at IS 'Timestamp when applicant responded to job edit';


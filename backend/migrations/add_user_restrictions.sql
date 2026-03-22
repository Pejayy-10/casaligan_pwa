-- Migration: Add user restriction fields
-- Description: Adds fields to track user restrictions (temporary or permanent bans)
-- Date: 2026-01-28

-- Add restriction fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS restriction_reason VARCHAR(500),
ADD COLUMN IF NOT EXISTS restriction_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS restriction_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS restricted_by_admin_id INTEGER;

-- Add index for faster restriction checks
CREATE INDEX IF NOT EXISTS idx_users_is_restricted ON users(is_restricted);
CREATE INDEX IF NOT EXISTS idx_users_restriction_end ON users(restriction_end);

-- Add comment
COMMENT ON COLUMN users.is_restricted IS 'Whether the user is currently restricted from using the platform';
COMMENT ON COLUMN users.restriction_reason IS 'Reason for the restriction (e.g., policy violation, reported behavior)';
COMMENT ON COLUMN users.restriction_start IS 'When the restriction started';
COMMENT ON COLUMN users.restriction_end IS 'When the restriction will end (NULL = permanent)';
COMMENT ON COLUMN users.restricted_by_admin_id IS 'ID of the admin who applied the restriction';

-- Migration: Add schedule conflict tracking to InterestCheck
-- Purpose: Track if an application was withdrawn due to schedule conflict
-- Date: 2026-03-06

-- Add column to track if withdrawal was due to conflict
ALTER TABLE interestcheck 
ADD COLUMN IF NOT EXISTS withdrawn_due_to_conflict BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_interestcheck_withdrawn_due_to_conflict 
ON interestcheck(worker_id, withdrawn_due_to_conflict);

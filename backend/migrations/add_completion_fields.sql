-- Add job completion fields to forumposts table
-- Run this in your Neon DB console

-- Add new columns for job completion tracking
ALTER TABLE forumposts ADD COLUMN IF NOT EXISTS completion_proof_url VARCHAR;
ALTER TABLE forumposts ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE forumposts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update the status enum to include pending_completion
-- First, create a new enum type with the additional value
DO $$ 
BEGIN 
    -- Check if the value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending_completion' 
        AND enumtypid = 'forumpoststatus'::regtype
    ) THEN
        ALTER TYPE forumpoststatus ADD VALUE 'pending_completion' AFTER 'ongoing';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns to payment_schedules table
ALTER TABLE payment_schedules ADD COLUMN IF NOT EXISTS frequency VARCHAR;
ALTER TABLE payment_schedules ADD COLUMN IF NOT EXISTS payment_amount NUMERIC;
ALTER TABLE payment_schedules ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE payment_schedules ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- Update the payment status enum to include overdue
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'overdue' 
        AND enumtypid = 'paymentstatus'::regtype
    ) THEN
        ALTER TYPE paymentstatus ADD VALUE 'overdue' AFTER 'disputed';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

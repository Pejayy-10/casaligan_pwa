-- Migration: Allow multiple contracts per job (one per worker)
-- Run this in your Neon DB console

-- Drop the unique constraint on post_id to allow multiple contracts per job
-- First, find and drop the constraint
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the unique constraint name on post_id
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'contracts'::regclass
    AND contype = 'u'
    AND array_to_string(conkey, ',') LIKE '%' || (
        SELECT attnum::text FROM pg_attribute 
        WHERE attrelid = 'contracts'::regclass AND attname = 'post_id'
    ) || '%';
    
    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE contracts DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No unique constraint found on post_id';
    END IF;
END $$;

-- Also try dropping by common naming patterns
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_post_id_key;
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_post_id_unique;

-- Add an index for faster lookups (non-unique)
CREATE INDEX IF NOT EXISTS idx_contracts_post_id ON contracts(post_id);
CREATE INDEX IF NOT EXISTS idx_contracts_worker_id ON contracts(worker_id);

-- Add worker_name column to payment_schedules for easier display
ALTER TABLE payment_schedules ADD COLUMN IF NOT EXISTS worker_id INTEGER REFERENCES workers(worker_id);
ALTER TABLE payment_schedules ADD COLUMN IF NOT EXISTS worker_name VARCHAR;

-- Add index for payment lookups by worker
CREATE INDEX IF NOT EXISTS idx_payment_schedules_worker ON payment_schedules(worker_id);

-- Add completion tracking columns to contracts (for per-worker completion)
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS completion_proof_url VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_proof_url VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add pending_completion to ContractStatus enum
DO $$
BEGIN
    -- Check if the value already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending_completion' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contractstatus')
    ) THEN
        ALTER TYPE contractstatus ADD VALUE IF NOT EXISTS 'pending_completion';
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, ignore
END $$;

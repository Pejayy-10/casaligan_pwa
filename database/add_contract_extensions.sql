-- Migration: Add contract_extensions table
-- This allows houseowners to propose contract extensions for ongoing contracts.
-- The housekeeper can then accept or reject the extension.

-- Create enum type for extension status
DO $$ BEGIN
  CREATE TYPE extension_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create contract_extensions table
CREATE TABLE IF NOT EXISTS public.contract_extensions (
  extension_id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES public.contracts(contract_id),
  proposed_by INTEGER NOT NULL REFERENCES public.users(id),           -- houseowner user_id
  proposed_end_date VARCHAR NOT NULL,                                  -- new proposed end date
  proposed_budget NUMERIC,                                             -- new proposed budget (optional)
  reason TEXT,                                                         -- reason for extension
  status extension_status NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMP WITH TIME ZONE,                               -- when worker accepted/rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Add notification types for extensions
-- (notification type is stored as varchar, so no enum migration needed)

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_contract_extensions_contract_id ON public.contract_extensions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_extensions_status ON public.contract_extensions(status);

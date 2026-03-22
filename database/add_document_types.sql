-- =======================================================
-- Add missing document types to enum
-- =======================================================
-- This script adds voters_id, postal_id, and other 
-- to the document_type enum
-- Run this in Supabase SQL Editor
-- =======================================================

-- Add new values to the document_type enum (each must be in separate transaction)
-- Run these one at a time or in separate executions

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'voters_id';

-- After the first one succeeds, run this:
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'postal_id';

-- After the second one succeeds, run this:
 ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'other';

-- Verify the enum values (run this after all three are added)
SELECT unnest(enum_range(NULL::document_type))::text as document_type_values;

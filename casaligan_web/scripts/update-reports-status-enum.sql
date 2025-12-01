-- Update reports_status enum to include 'dismissed' and 'restricted' status
-- This script adds 'dismissed' and 'restricted' to the reports_status enum

-- Add 'dismissed' to reports_status enum (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'dismissed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'reports_status')
    ) THEN
        ALTER TYPE reports_status ADD VALUE 'dismissed';
    END IF;
END $$;

-- Add 'restricted' to reports_status enum (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'restricted' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'reports_status')
    ) THEN
        ALTER TYPE reports_status ADD VALUE 'restricted';
    END IF;
END $$;

-- Verify the enum values
SELECT enumlabel as reports_status_value
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'reports_status')
ORDER BY enumsortorder;


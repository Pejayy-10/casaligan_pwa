-- Update notification_type enum to include new notification types
-- This script adds 'warning', 'restriction', and 'info' to the notification_type enum

-- First, check if the enum exists and what values it currently has
-- Then add the new values we need

-- Add 'info' to notification_type enum (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'info' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'info';
    END IF;
END $$;

-- Add 'warning' to notification_type enum (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'warning' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'warning';
    END IF;
END $$;

-- Add 'restriction' to notification_type enum (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'restriction' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'restriction';
    END IF;
END $$;

-- Add 'alert' to notification_type enum (if it doesn't exist) - as a fallback option
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'alert' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
    ) THEN
        ALTER TYPE notification_type ADD VALUE 'alert';
    END IF;
END $$;

-- Verify the enum values
SELECT enumlabel as notification_type_value
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
ORDER BY enumsortorder;


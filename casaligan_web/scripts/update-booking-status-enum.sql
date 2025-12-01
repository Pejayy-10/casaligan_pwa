-- Script to check and update booking status enum values
-- Run this in your Supabase SQL Editor

-- Step 1: Check current enum values for booking status
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%booking%' OR t.typname LIKE '%status%'
ORDER BY t.typname, e.enumsortorder;

-- Step 2: If the booking status enum doesn't have the required values, 
-- you need to add them. First, find the exact enum type name from Step 1 results.
-- Replace 'booking_status_enum' below with the actual enum type name if different.

-- Add 'ongoing' status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'ongoing' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
    ) THEN
        ALTER TYPE booking_status ADD VALUE 'ongoing';
    END IF;
END $$;

-- Add 'completed' status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
    ) THEN
        ALTER TYPE booking_status ADD VALUE 'completed';
    END IF;
END $$;

-- Add 'cancelled' status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'cancelled' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
    ) THEN
        ALTER TYPE booking_status ADD VALUE 'cancelled';
    END IF;
END $$;

-- Add 'pending' status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
    ) THEN
        ALTER TYPE booking_status ADD VALUE 'pending';
    END IF;
END $$;

-- Add 'confirmed' status if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'confirmed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
    ) THEN
        ALTER TYPE booking_status ADD VALUE 'confirmed';
    END IF;
END $$;

-- Step 3: Verify the changes
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'booking_status'
ORDER BY e.enumsortorder;

-- Expected result should include:
-- pending
-- confirmed
-- ongoing
-- completed
-- cancelled

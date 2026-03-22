-- =======================================================
-- CLEANUP SCRIPT: Remove unnecessary location tables
-- =======================================================
-- This script removes the provinces, cities, and barangays tables
-- and their foreign key references from the addresses table
-- since we're using text fields directly in the addresses table
-- 
-- Run this in Supabase SQL Editor
-- =======================================================

-- Step 1: Drop foreign key constraints from addresses table
ALTER TABLE addresses 
    DROP CONSTRAINT IF EXISTS addresses_province_id_fkey,
    DROP CONSTRAINT IF EXISTS addresses_city_id_fkey,
    DROP CONSTRAINT IF EXISTS addresses_barangay_id_fkey;

-- Step 2: Drop indexes related to the foreign keys
DROP INDEX IF EXISTS idx_addresses_province;
DROP INDEX IF EXISTS idx_addresses_city;
DROP INDEX IF EXISTS idx_addresses_barangay;

-- Step 3: Remove the foreign key columns and redundant street column from addresses table
ALTER TABLE addresses
    DROP COLUMN IF EXISTS province_id,
    DROP COLUMN IF EXISTS city_id,
    DROP COLUMN IF EXISTS barangay_id,
    DROP COLUMN IF EXISTS street;

-- Step 4: Drop the location tables (cascading will handle related data)
DROP TABLE IF EXISTS barangays CASCADE;
DROP TABLE IF EXISTS cities CASCADE;
DROP TABLE IF EXISTS provinces CASCADE;

-- Step 5: Verify the tables are gone
SELECT 
    table_name 
FROM information_schema.tables 
WHERE 
    table_schema = 'public' 
    AND table_name IN ('provinces', 'cities', 'barangays')
ORDER BY table_name;

-- This query should return 0 rows if successful

-- Step 6: Verify addresses table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE 
    table_name = 'addresses'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Success! The addresses table should now only have text fields for location data
-- (region_name, province_name, city_name, barangay_name, street_address, etc.)

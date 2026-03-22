-- Check the enum values for booking status
-- Run this in your Supabase SQL editor to see what status values are available

SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%booking%' OR t.typname LIKE '%status%'
ORDER BY t.typname, e.enumsortorder;

-- If booking status enum doesn't have 'ongoing', 'completed', 'cancelled', run this:
-- ALTER TYPE <enum_name> ADD VALUE IF NOT EXISTS 'ongoing';
-- ALTER TYPE <enum_name> ADD VALUE IF NOT EXISTS 'completed';
-- ALTER TYPE <enum_name> ADD VALUE IF NOT EXISTS 'cancelled';

-- Query to find the correct enum values for package availability
SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%availab%' OR t.typname LIKE '%package%'
ORDER BY t.typname, e.enumsortorder;

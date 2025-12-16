-- Migration: Make category_id required in packages table
-- Note: package_categories table and data already exist in database

-- Step 1: Update existing packages that don't have a category to use the first available category
UPDATE public.packages 
SET category_id = (SELECT category_id FROM public.package_categories LIMIT 1)
WHERE category_id IS NULL;

-- Step 2: Make category_id required (if not already)
DO $$ 
BEGIN
    -- Check if column is nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'packages' 
        AND column_name = 'category_id'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.packages 
        ALTER COLUMN category_id SET NOT NULL;
        RAISE NOTICE 'category_id set to NOT NULL';
    ELSE
        RAISE NOTICE 'category_id already NOT NULL';
    END IF;
END $$;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'All packages now have a category assigned.';
END $$;


-- Add category_id to job posts (forumposts table)
-- This allows job posts to be categorized just like packages

-- Step 1: Add the category_id column (nullable first)
ALTER TABLE forumposts 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES package_categories(category_id);

-- Step 2: Set default category for existing posts
-- Get the first available category and assign it to posts without a category
UPDATE forumposts 
SET category_id = (
    SELECT category_id 
    FROM package_categories 
    WHERE is_active = true 
    LIMIT 1
)
WHERE category_id IS NULL;

-- Step 3: Make category_id required for future posts (optional - uncomment if you want it required)
-- ALTER TABLE forumposts 
-- ALTER COLUMN category_id SET NOT NULL;

-- Verify the changes
SELECT COUNT(*) as total_jobs, 
       COUNT(category_id) as jobs_with_category 
FROM forumposts;

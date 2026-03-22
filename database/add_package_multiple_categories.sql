-- Migration: Allow packages to have multiple categories
-- This creates a many-to-many relationship between packages and categories

-- Step 1: Create junction table for package-category relationships
CREATE TABLE IF NOT EXISTS public.package_category_mappings (
    package_id integer NOT NULL,
    category_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT package_category_mappings_pkey PRIMARY KEY (package_id, category_id),
    CONSTRAINT package_category_mappings_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(package_id) ON DELETE CASCADE,
    CONSTRAINT package_category_mappings_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.package_categories(category_id) ON DELETE CASCADE
);

-- Step 2: Migrate existing data from packages.category_id to the new junction table
INSERT INTO public.package_category_mappings (package_id, category_id)
SELECT package_id, category_id 
FROM public.packages 
WHERE category_id IS NOT NULL
ON CONFLICT (package_id, category_id) DO NOTHING;

-- Step 3: Keep the category_id column for backward compatibility
-- (Remove the NOT NULL constraint so packages can have categories only in the junction table)
ALTER TABLE public.packages ALTER COLUMN category_id DROP NOT NULL;

-- Step 4: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_package_category_mappings_package 
ON public.package_category_mappings(package_id);

CREATE INDEX IF NOT EXISTS idx_package_category_mappings_category 
ON public.package_category_mappings(category_id);

-- Verification query - Check the migration worked
-- SELECT p.package_id, p.name, p.category_id as old_category, 
--        array_agg(pcm.category_id) as new_categories
-- FROM packages p
-- LEFT JOIN package_category_mappings pcm ON p.package_id = pcm.package_id
-- GROUP BY p.package_id, p.name, p.category_id;

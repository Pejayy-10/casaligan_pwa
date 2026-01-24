-- Add multiple categories support for job posts
-- Create junction table for job-category many-to-many relationship

-- Create the junction table
CREATE TABLE IF NOT EXISTS job_category_mapping (
    post_id INTEGER NOT NULL REFERENCES forumposts(post_id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES package_categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, category_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_job_category_mapping_post_id ON job_category_mapping(post_id);
CREATE INDEX IF NOT EXISTS idx_job_category_mapping_category_id ON job_category_mapping(category_id);

-- Migrate existing data (copy single category to junction table)
INSERT INTO job_category_mapping (post_id, category_id)
SELECT post_id, category_id 
FROM forumposts 
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Optional: Keep category_id column for backward compatibility
-- Or you can remove it after migration with:
-- ALTER TABLE forumposts DROP COLUMN category_id;

COMMENT ON TABLE job_category_mapping IS 'Junction table for many-to-many relationship between job posts and categories';

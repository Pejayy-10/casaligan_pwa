-- Add num_days column to packages table
-- This allows housekeepers to set how many days a package will take to complete

ALTER TABLE packages ADD COLUMN IF NOT EXISTS num_days INTEGER DEFAULT 1;

-- Update existing packages to have default value
UPDATE packages SET num_days = 1 WHERE num_days IS NULL;

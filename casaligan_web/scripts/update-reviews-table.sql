-- Update Reviews Table for Admin Dashboard
-- This script adds columns needed for the admin reviews management page

-- Add reviewer and target user columns
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS reviewer_user_id integer,
ADD COLUMN IF NOT EXISTS target_user_id integer,
ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hidden_at timestamp without time zone,
ADD COLUMN IF NOT EXISTS hidden_by_admin_id integer,
ADD COLUMN IF NOT EXISTS warned_at timestamp without time zone,
ADD COLUMN IF NOT EXISTS warned_by_admin_id integer,
ADD COLUMN IF NOT EXISTS restricted_at timestamp without time zone,
ADD COLUMN IF NOT EXISTS restricted_by_admin_id integer;

-- Add foreign key constraints
ALTER TABLE reviews
ADD CONSTRAINT reviews_reviewer_user_id_fkey 
  FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id),
ADD CONSTRAINT reviews_target_user_id_fkey 
  FOREIGN KEY (target_user_id) REFERENCES users(user_id),
ADD CONSTRAINT reviews_hidden_by_admin_id_fkey 
  FOREIGN KEY (hidden_by_admin_id) REFERENCES admins(admin_id),
ADD CONSTRAINT reviews_warned_by_admin_id_fkey 
  FOREIGN KEY (warned_by_admin_id) REFERENCES admins(admin_id),
ADD CONSTRAINT reviews_restricted_by_admin_id_fkey 
  FOREIGN KEY (restricted_by_admin_id) REFERENCES admins(admin_id);

-- Create an index for faster queries on reviewer and target
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON reviews(is_hidden);

-- Update existing reviews to populate reviewer and target from contracts
-- This sets reviewer as the employer and target as the worker from the contract's booking
UPDATE reviews r
SET 
  reviewer_user_id = (
    SELECT e.user_id 
    FROM contracts c
    JOIN bookings b ON c.booking_id = b.booking_id
    JOIN schedules s ON b.schedule_id = s.schedule_id
    JOIN employers e ON s.employer_id = e.employer_id
    WHERE c.contract_id = r.contract_id
  ),
  target_user_id = (
    SELECT w.user_id 
    FROM contracts c
    JOIN bookings b ON c.booking_id = b.booking_id
    JOIN schedules s ON b.schedule_id = s.schedule_id
    JOIN packages p ON s.package_id = p.package_id
    JOIN workers w ON p.worker_id = w.worker_id
    WHERE c.contract_id = r.contract_id
  )
WHERE reviewer_user_id IS NULL OR target_user_id IS NULL;

-- Note: To use this script:
-- 1. Execute this script in your Supabase SQL editor or PostgreSQL client
-- 2. This will add new columns to track reviewer, target, and admin actions on reviews
-- 3. Existing reviews will be updated with reviewer/target data from their contracts

-- Fix worker_packages view issue
-- Run this in Supabase SQL Editor

-- Drop the view if it exists
DROP VIEW IF EXISTS worker_packages CASCADE;

-- Recreate as a proper table
CREATE TABLE IF NOT EXISTS worker_packages (
    package_id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    duration_hours INTEGER NOT NULL DEFAULT 2,
    services JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_worker_packages_worker ON worker_packages(worker_id);

-- Verify the table was created (should return 'table')
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'worker_packages';

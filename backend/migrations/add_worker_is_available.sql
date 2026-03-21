-- Migration: Add is_available column to workers table
-- This allows housekeepers to toggle their availability for direct hire requests.
-- When is_available = false, employers cannot create new direct hire bookings for that worker.

ALTER TABLE workers
    ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

-- Migration: Add latitude and longitude columns to addresses table
-- Date: 2024
-- Description: Adds GPS coordinate fields to support real-time location tracking for worker browsing

-- Add latitude and longitude columns to addresses table
ALTER TABLE public.addresses 
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision;

-- Add comments for documentation
COMMENT ON COLUMN public.addresses.latitude IS 'GPS latitude coordinate for location-based features';
COMMENT ON COLUMN public.addresses.longitude IS 'GPS longitude coordinate for location-based features';

-- Optional: Create index for location-based queries (if you plan to do spatial queries)
-- CREATE INDEX IF NOT EXISTS idx_addresses_location ON public.addresses USING GIST (point(longitude, latitude));


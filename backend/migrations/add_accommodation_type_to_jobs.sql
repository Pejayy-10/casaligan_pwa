-- Migration: Add accommodation_type column to forumposts
-- accommodation_type indicates whether the housekeeper should stay-in or stay-out
-- Values: 'stay_in' | 'stay_out' (default: 'stay_out')

ALTER TABLE forumposts
  ADD COLUMN IF NOT EXISTS accommodation_type VARCHAR(20) NOT NULL DEFAULT 'stay_out';

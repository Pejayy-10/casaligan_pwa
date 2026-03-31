-- Migration: Add alternate phone number to workers table
-- Housekeepers can optionally register a second contact number.
-- The number must be OTP-verified before it is stored.

ALTER TABLE workers
    ADD COLUMN IF NOT EXISTS alt_phone_number  VARCHAR(20)  NULL,
    ADD COLUMN IF NOT EXISTS alt_phone_verified BOOLEAN     NOT NULL DEFAULT false;

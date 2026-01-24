-- Add PAYMENT_PENDING status to DirectHireStatus enum
-- This allows employers to submit payment which workers must then review and confirm

-- Add the new status to the enum
ALTER TYPE direct_hire_status ADD VALUE IF NOT EXISTS 'payment_pending';

-- Update any existing comments/documentation
COMMENT ON COLUMN direct_hires.status IS 'Current status of the direct hire booking. Values: pending, accepted, in_progress, pending_completion, completed, payment_pending, paid, cancelled, rejected';

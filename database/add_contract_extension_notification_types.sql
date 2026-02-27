-- Add contract extension notification types to the notification_type enum
-- Run this in your Supabase SQL Editor BEFORE using the contract extension feature

-- Add 'contract_extension_proposed'
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contract_extension_proposed';

-- Add 'contract_extension_accepted'
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contract_extension_accepted';

-- Add 'contract_extension_rejected'
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contract_extension_rejected';

-- Also add 'job_edited' if missing (used by job edit tracking)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'job_edited';

-- Also add 'payment_review' if missing (used by payment review feature)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_review';

-- Verify all values are present
SELECT enumlabel AS notification_type_value
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
ORDER BY enumsortorder;

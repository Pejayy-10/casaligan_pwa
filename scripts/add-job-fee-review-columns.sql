-- Adds fee-review columns required by admin page: /jobs/fee-reviews
-- Safe to run multiple times.

ALTER TABLE forumposts
  ADD COLUMN IF NOT EXISTS platform_fee_total numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS platform_fee_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform_fee_payment_ref text,
  ADD COLUMN IF NOT EXISTS admin_review_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz;

-- Optional consistency updates for existing rows
UPDATE forumposts
SET
  platform_fee_total = COALESCE(platform_fee_total, 0),
  platform_fee_status = COALESCE(NULLIF(platform_fee_status, ''), 'pending'),
  admin_review_status = COALESCE(NULLIF(admin_review_status, ''), 'pending')
WHERE
  platform_fee_total IS NULL
  OR platform_fee_status IS NULL OR platform_fee_status = ''
  OR admin_review_status IS NULL OR admin_review_status = '';

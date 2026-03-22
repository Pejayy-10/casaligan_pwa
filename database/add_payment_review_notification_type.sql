-- Add payment_review to notification_type enum
-- This allows notifications for payment review/confirmation

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_review';

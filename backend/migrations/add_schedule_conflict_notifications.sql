-- Migration: Add schedule conflict notification types
-- Purpose: Add new notification types for schedule conflict feature
-- Date: 2026-03-06

-- Since notification_type is an ENUM, we need to add new values
-- PostgreSQL 12+ allows adding to existing enums
-- For older versions, we would need to recreate the type

-- Try the direct approach first (PostgreSQL 12+)
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'application_withdrawn_due_to_conflict' AFTER 'contract_extension_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'applicant_withdrawn_due_to_conflict' AFTER 'application_withdrawn_due_to_conflict';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'direct_hire_rejected_due_to_conflict' AFTER 'applicant_withdrawn_due_to_conflict';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hire_canceled_worker_accepted_conflict' AFTER 'direct_hire_rejected_due_to_conflict';

-- Also add missing types that should be there
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contract_extension_proposed' AFTER 'direct_hire_paid';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contract_extension_accepted' AFTER 'contract_extension_proposed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'contract_extension_rejected' AFTER 'contract_extension_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'job_edited' AFTER 'job_started';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_review' AFTER 'payment_received';

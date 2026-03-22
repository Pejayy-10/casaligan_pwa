-- ============================================
-- SIMPLIFIED REPORTS TABLE SETUP
-- ============================================
-- This script will drop the old complex reports table 
-- and create a new simplified one
-- 
-- Paste this into Supabase SQL Editor and run it
-- ============================================

-- Drop the old reports table (this will delete all existing reports!)
DROP TABLE IF EXISTS public.reports CASCADE;

-- Create a simple reports table
CREATE TABLE public.reports (
  report_id SERIAL PRIMARY KEY,
  reporter_user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  reported_user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITHOUT TIME ZONE,
  resolved_by_admin_id INTEGER REFERENCES public.admins(admin_id) ON DELETE SET NULL,
  admin_notes TEXT,
  
  -- Add a check constraint to prevent self-reporting
  CONSTRAINT no_self_report CHECK (reporter_user_id != reported_user_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_reports_reporter ON public.reports(reporter_user_id);
CREATE INDEX idx_reports_reported_user ON public.reports(reported_user_id);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_created_at ON public.reports(created_at DESC);

-- Insert sample data with variety of scenarios
INSERT INTO public.reports (reporter_user_id, reported_user_id, reason, description, status) VALUES
  -- Pending reports (need admin action)
  (2, 3, 'Inappropriate Behavior', 'User was rude and unprofessional during interview. Used offensive language and made discriminatory remarks.', 'pending'),
  (3, 2, 'No Show', 'Employer did not show up for scheduled interview. I waited for 2 hours without any communication.', 'pending'),
  (4, 5, 'Unprofessional Conduct', 'Worker arrived late multiple times and did not complete assigned tasks properly.', 'pending'),
  (5, 6, 'Payment Issues', 'Employer refuses to pay agreed salary. Contract was clear but they are avoiding payment.', 'pending'),
  (6, 7, 'False Information', 'Worker lied about qualifications and experience. Does not have the certifications they claimed.', 'pending'),
  (7, 8, 'Safety Concerns', 'Unsafe working conditions. Employer does not provide proper safety equipment.', 'pending'),
  (8, 9, 'Contract Violation', 'Worker left job without notice, violating the agreed contract terms.', 'pending'),
  (9, 10, 'Disrespectful Behavior', 'Employer makes inappropriate comments and does not respect personal boundaries.', 'pending'),
  
  -- Resolved reports (admin took action)
  (10, 4, 'Harassment', 'Received inappropriate messages from this user. Sent explicit content despite being told to stop.', 'resolved'),
  (4, 11, 'Threatening Behavior', 'User made threatening statements when I declined the job offer.', 'resolved'),
  (11, 12, 'Identity Fraud', 'This user is using fake credentials and stolen identity documents.', 'resolved'),
  (12, 2, 'Spam Messages', 'User keeps sending spam messages and irrelevant job offers.', 'resolved'),
  
  -- Dismissed reports (no action needed)
  (2, 13, 'Spam', 'User sent too many messages', 'dismissed'),
  (13, 14, 'Minor Complaint', 'Just a misunderstanding about schedule', 'dismissed'),
  (14, 15, 'Resolved Privately', 'We worked it out between us, no admin action needed', 'dismissed');

-- Display the new table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'reports' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM public.reports ORDER BY created_at DESC;


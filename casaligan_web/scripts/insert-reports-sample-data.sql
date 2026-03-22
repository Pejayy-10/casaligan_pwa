-- ============================================
-- INSERT SAMPLE REPORTS DATA
-- ============================================
-- Run this to add sample reports to your existing reports table
-- ============================================

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
  (10, 11, 'Poor Communication', 'Employer never responds to messages or calls. Very difficult to coordinate work schedules.', 'pending'),
  (11, 12, 'Unsanitary Conditions', 'Work environment is extremely dirty and unhealthy. Employer refuses to improve conditions.', 'pending'),
  
  -- Resolved reports (admin took action)
  (10, 4, 'Harassment', 'Received inappropriate messages from this user. Sent explicit content despite being told to stop.', 'resolved'),
  (4, 11, 'Threatening Behavior', 'User made threatening statements when I declined the job offer.', 'resolved'),
  (11, 12, 'Identity Fraud', 'This user is using fake credentials and stolen identity documents.', 'resolved'),
  (12, 2, 'Spam Messages', 'User keeps sending spam messages and irrelevant job offers.', 'resolved'),
  (13, 14, 'Scam Attempt', 'User tried to get personal banking information before hiring. Definitely a scam.', 'resolved'),
  
  -- Dismissed reports (no action needed)
  (2, 13, 'Spam', 'User sent too many messages', 'dismissed'),
  (13, 14, 'Minor Complaint', 'Just a misunderstanding about schedule', 'dismissed'),
  (14, 15, 'Resolved Privately', 'We worked it out between us, no admin action needed', 'dismissed'),
  (15, 16, 'Duplicate Report', 'This was already reported and handled', 'dismissed'),
  (16, 17, 'Not Relevant', 'Report was filed by mistake', 'dismissed');

-- Show the inserted reports
SELECT 
  report_id,
  reporter_user_id,
  reported_user_id,
  reason,
  status,
  created_at
FROM public.reports 
ORDER BY created_at DESC;

-- Show count by status
SELECT 
  status,
  COUNT(*) as count
FROM public.reports 
GROUP BY status
ORDER BY status;


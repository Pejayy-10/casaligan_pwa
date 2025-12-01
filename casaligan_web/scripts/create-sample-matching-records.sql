-- Sample data for matching_records table
-- This creates realistic matching records for testing

-- First, let's verify we have employers, workers, and packages
-- If you don't have these yet, run the sample bookings script first

-- Insert sample matching records (Status: successful or failed only)
-- Using actual package IDs from your database (1-5, 301-305)
INSERT INTO public.matching_records (employer_id, worker_id, package_id, match_score, match_date, status, notes)
VALUES
  -- Marie Jane Cruz matches
  (1, 1, 1, 92.50, '2025-09-24 10:30:00', 'successful', 'Hired for stay-in'),
  (1, 1, 2, 88.75, '2025-09-19 14:20:00', 'successful', 'Weekend work only'),
  (1, 1, 3, 75.20, '2025-09-18 09:15:00', 'failed', 'Decline by employer'),
  (1, 1, 4, 85.60, '2025-09-14 11:45:00', 'successful', 'Part-time nanny'),
  (1, 1, 5, 70.30, '2025-09-10 16:00:00', 'failed', 'Schedule conflict'),
  
  -- Roberto Garcia matches
  (2, 2, 301, 94.80, '2025-09-22 08:00:00', 'successful', 'Full-time housekeeping'),
  (2, 2, 302, 82.40, '2025-09-20 13:30:00', 'successful', 'Cooking and cleaning'),
  (2, 3, 303, 78.90, '2025-09-15 10:00:00', 'failed', 'Worker declined'),
  (2, 1, 304, 91.20, '2025-09-12 15:45:00', 'successful', 'Child care specialist'),
  (2, 2, 305, 68.50, '2025-09-08 12:00:00', 'failed', 'Budget constraints'),
  
  -- Ana Reyes matches
  (3, 3, 1, 89.70, '2025-09-25 09:00:00', 'successful', 'Elder care specialist'),
  (3, 1, 2, 86.30, '2025-09-21 11:15:00', 'successful', 'Part-time assistance'),
  (3, 2, 3, 73.60, '2025-09-17 14:00:00', 'failed', 'Location too far'),
  (3, 3, 4, 90.10, '2025-09-13 10:30:00', 'successful', 'Live-in caregiver'),
  (3, 1, 5, 77.80, '2025-09-09 16:30:00', 'failed', 'Qualifications mismatch'),
  
  -- Additional recent matches
  (1, 2, 301, 93.40, '2025-11-15 09:30:00', 'successful', 'Holiday season help'),
  (2, 3, 302, 87.20, '2025-11-10 14:00:00', 'successful', 'Deep cleaning service'),
  (3, 1, 303, 79.50, '2025-11-05 11:00:00', 'failed', 'Schedule incompatible'),
  (1, 3, 304, 95.60, '2025-11-01 10:00:00', 'successful', 'Premium service package'),
  (2, 1, 305, 81.30, '2025-10-28 13:00:00', 'successful', 'Weekly maintenance'),
  
  -- More recent matches for variety
  (3, 2, 1, 88.90, '2025-11-20 15:30:00', 'successful', 'Special event catering'),
  (1, 1, 2, 72.40, '2025-11-18 09:00:00', 'failed', 'Price negotiation failed'),
  (2, 3, 3, 91.80, '2025-11-16 12:45:00', 'successful', 'Garden maintenance included'),
  (3, 2, 4, 76.70, '2025-11-12 16:00:00', 'failed', 'Worker unavailable'),
  (1, 3, 5, 94.20, '2025-11-08 10:30:00', 'successful', 'Long-term contract');

-- Verification query
SELECT 
  mr.match_id,
  eu.name as employer_name,
  wu.name as worker_name,
  p.title as package_title,
  mr.match_score,
  mr.match_date,
  mr.status,
  mr.notes
FROM matching_records mr
JOIN employers e ON mr.employer_id = e.employer_id
JOIN users eu ON e.user_id = eu.user_id
JOIN workers w ON mr.worker_id = w.worker_id
JOIN users wu ON w.user_id = wu.user_id
LEFT JOIN packages p ON mr.package_id = p.package_id
ORDER BY mr.match_date DESC;

-- Count by status
SELECT status, COUNT(*) as count
FROM matching_records
GROUP BY status;

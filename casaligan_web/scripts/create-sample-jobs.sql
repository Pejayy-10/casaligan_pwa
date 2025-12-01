-- Sample Job Posts Data for Kasambahay Connect
-- This script creates sample job postings in the forumposts table

-- Note: Before running this script, ensure you have employers in your database
-- You can use the employer_id from existing employers or create test employers first

-- Insert sample job posts
INSERT INTO forumposts (employer_id, title, description, category, status, created_at)
VALUES
  (1, 'Full-Time Nanny Needed', 'Looking for an experienced nanny to take care of two children (ages 3 and 5). Must be patient, reliable, and have experience with young children. Live-in or live-out options available. Good compensation package.', 'Childcare', 'open', NOW() - INTERVAL '5 days'),
  
  (2, 'House Cleaning Services - Weekly', 'Need a reliable house cleaner for a 3-bedroom apartment. Weekly cleaning every Saturday. Must bring own cleaning supplies. Experience preferred. Competitive hourly rate.', 'Housekeeping', 'open', NOW() - INTERVAL '3 days'),
  
  (3, 'Garden Maintenance Worker', 'Seeking an experienced gardener for regular maintenance of a medium-sized garden. Tasks include lawn mowing, trimming, planting, and general upkeep. Twice a week schedule.', 'Gardening', 'open', NOW() - INTERVAL '7 days'),
  
  (4, 'Live-In Laundry Helper', 'Looking for a dedicated laundry helper for a family of 5. Responsibilities include washing, ironing, and organizing clothes. Accommodation and meals provided. Start immediately.', 'Laundry', 'open', NOW() - INTERVAL '10 days'),
  
  (5, 'Kitchen Helper / Cook', 'Need a kitchen helper who can prepare Filipino and international dishes. Must be able to cook for a family of 4. Knowledge of basic cooking techniques required. Part-time position, 4 hours daily.', 'Cooking', 'open', NOW() - INTERVAL '2 days'),
  
  (6, 'Elderly Care Companion', 'Seeking a compassionate caregiver for an elderly parent. Responsibilities include assistance with daily activities, medication reminders, and companionship. Must be patient and caring.', 'Eldercare', 'open', NOW() - INTERVAL '6 days'),
  
  (7, 'Part-Time Driver', 'Looking for a reliable driver with a clean driving record. Will drive children to school and run occasional errands. Must have professional driver''s license. Flexible schedule.', 'Driving', 'open', NOW() - INTERVAL '4 days'),
  
  (8, 'General Household Helper', 'Need an all-around household helper for various tasks including cleaning, cooking, and laundry. Live-in position with day off every week. Family-friendly environment.', 'General Help', 'closed', NOW() - INTERVAL '15 days');

-- Note: To use this script:
-- 1. This script uses employer_id values from 1 to 8, matching your existing employers
-- 2. Execute this script in your Supabase SQL editor or PostgreSQL client
-- 3. The job posts will appear in your admin dashboard immediately

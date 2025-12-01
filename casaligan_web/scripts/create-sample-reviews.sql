-- Sample Reviews Data for Kasambahay Connect
-- This script creates sample reviews in the reviews table
-- Make sure to run update-reviews-table.sql first to add the required columns

-- First, temporarily allow NULL for contract_id
ALTER TABLE reviews ALTER COLUMN contract_id DROP NOT NULL;

-- Sample reviews from employers to workers
-- Using employer user_ids 1-8 and worker user_ids 11-18
INSERT INTO reviews (reviewer_user_id, target_user_id, rating, comment, created_at, is_hidden)
VALUES
  (1, 11, 5, 'Excellent service! Very reliable and professional. My children love her and she takes great care of them. Highly recommended!', NOW() - INTERVAL '10 days', false),
  
  (2, 12, 4, 'Good work overall. Very punctual and thorough with cleaning. Only minor issue was communication could be better.', NOW() - INTERVAL '8 days', false),
  
  (3, 13, 3, 'Average performance. Gets the job done but not very proactive. Sometimes needs reminders about tasks.', NOW() - INTERVAL '6 days', false),
  
  (4, 14, 5, 'Outstanding! Very skilled in laundry and ironing. Clothes always look perfect. Very trustworthy and hardworking.', NOW() - INTERVAL '5 days', false),
  
  (5, 15, 2, 'Disappointed with the service. Often late and food quality was inconsistent. Had to let them go after 2 weeks.', NOW() - INTERVAL '4 days', false),
  
  (6, 16, 5, 'Wonderful caregiver! Very patient and caring with my elderly mother. Great communication and very professional.', NOW() - INTERVAL '3 days', false),
  
  (7, 17, 4, 'Good driver, safe and punctual. Kids feel comfortable with him. Only minor issue is needs better route planning.', NOW() - INTERVAL '2 days', false),
  
  (8, 18, 1, 'Very unprofessional behavior. Did not follow instructions and was rude when corrected. Would not recommend.', NOW() - INTERVAL '1 day', false);

-- Note: To use this script:
-- 1. Make sure you have run update-reviews-table.sql first
-- 2. This script uses employer user_ids 1-8 and worker user_ids 11-18
-- 3. If your user IDs are different, update the values in the INSERT statement
-- 4. To check your user IDs, run: 
--    SELECT u.user_id, u.name, u.role FROM users u ORDER BY u.user_id;
-- 5. Execute this script in your Supabase SQL editor

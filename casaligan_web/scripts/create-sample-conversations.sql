-- Sample Conversations and Messages
-- This script creates sample conversations between employers and workers with messages

-- Insert sample conversations
INSERT INTO conversations (conversation_id, created_at, last_message_at, last_message, topic, status)
VALUES 
  (1, NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 hours', 'Thank you for your interest. When can you start?', 'Nanny Position Inquiry', 'active'),
  (2, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', 'I am available on weekdays from 8 AM to 5 PM.', 'House Cleaning Schedule', 'active'),
  (3, NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days', 'Please provide your references and certifications.', 'Elderly Care Application', 'active'),
  (4, NOW() - INTERVAL '15 days', NOW() - INTERVAL '5 hours', 'The salary is negotiable based on experience.', 'Laundry Service Discussion', 'active'),
  (5, NOW() - INTERVAL '3 days', NOW() - INTERVAL '30 minutes', 'I have 5 years of experience in cooking Filipino dishes.', 'Kitchen Helper Position', 'active'),
  (6, NOW() - INTERVAL '12 days', NOW() - INTERVAL '6 days', 'This conversation has been restricted due to policy violation.', 'Garden Maintenance', 'restricted'),
  (7, NOW() - INTERVAL '8 days', NOW() - INTERVAL '4 hours', 'Can we schedule an interview next week?', 'Driver Position', 'active'),
  (8, NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days', 'I am looking for a live-in worker. Is that okay?', 'General Helper Inquiry', 'active');

-- Reset sequence to continue from 9
SELECT setval('conversations_conversation_id_seq', 8, true);

-- Insert conversation participants (employers with user_id 1-8, workers with user_id 11-18)
INSERT INTO conversation_participants (conversation_id, user_id, joined_at, role)
VALUES 
  -- Conversation 1: Employer 1 (user_id 1) and Worker 1 (user_id 11)
  (1, 1, NOW() - INTERVAL '7 days', 'employer'),
  (1, 11, NOW() - INTERVAL '7 days', 'worker'),
  
  -- Conversation 2: Employer 2 (user_id 2) and Worker 2 (user_id 12)
  (2, 2, NOW() - INTERVAL '5 days', 'employer'),
  (2, 12, NOW() - INTERVAL '5 days', 'worker'),
  
  -- Conversation 3: Employer 3 (user_id 3) and Worker 3 (user_id 13)
  (3, 3, NOW() - INTERVAL '10 days', 'employer'),
  (3, 13, NOW() - INTERVAL '10 days', 'worker'),
  
  -- Conversation 4: Employer 4 (user_id 4) and Worker 4 (user_id 14)
  (4, 4, NOW() - INTERVAL '15 days', 'employer'),
  (4, 14, NOW() - INTERVAL '15 days', 'worker'),
  
  -- Conversation 5: Employer 5 (user_id 5) and Worker 5 (user_id 15)
  (5, 5, NOW() - INTERVAL '3 days', 'employer'),
  (5, 15, NOW() - INTERVAL '3 days', 'worker'),
  
  -- Conversation 6: Employer 6 (user_id 6) and Worker 6 (user_id 16) - RESTRICTED
  (6, 6, NOW() - INTERVAL '12 days', 'employer'),
  (6, 16, NOW() - INTERVAL '12 days', 'worker'),
  
  -- Conversation 7: Employer 7 (user_id 7) and Worker 7 (user_id 17)
  (7, 7, NOW() - INTERVAL '8 days', 'employer'),
  (7, 17, NOW() - INTERVAL '8 days', 'worker'),
  
  -- Conversation 8: Employer 8 (user_id 8) and Worker 8 (user_id 18)
  (8, 8, NOW() - INTERVAL '20 days', 'employer'),
  (8, 18, NOW() - INTERVAL '20 days', 'worker');

-- Insert sample messages for each conversation
INSERT INTO messages (conversation_id, sender_user_id, content, sent_at)
VALUES 
  -- Conversation 1 messages
  (1, 1, 'Hello, I saw your profile and I''m interested in hiring you as a nanny for my two children.', NOW() - INTERVAL '7 days'),
  (1, 11, 'Hello! Thank you for reaching out. I would love to discuss this opportunity with you.', NOW() - INTERVAL '7 days' + INTERVAL '2 hours'),
  (1, 1, 'Great! Do you have experience with toddlers?', NOW() - INTERVAL '6 days'),
  (1, 11, 'Yes, I have 3 years of experience caring for children ages 1-5.', NOW() - INTERVAL '6 days' + INTERVAL '1 hour'),
  (1, 1, 'Thank you for your interest. When can you start?', NOW() - INTERVAL '2 hours'),
  
  -- Conversation 2 messages
  (2, 2, 'I need someone for house cleaning twice a week. Are you available?', NOW() - INTERVAL '5 days'),
  (2, 12, 'Yes, I am available. What days work best for you?', NOW() - INTERVAL '5 days' + INTERVAL '3 hours'),
  (2, 2, 'Tuesday and Friday would be perfect.', NOW() - INTERVAL '4 days'),
  (2, 12, 'I am available on weekdays from 8 AM to 5 PM.', NOW() - INTERVAL '1 day'),
  
  -- Conversation 3 messages
  (3, 3, 'My elderly mother needs daily care. Can you help?', NOW() - INTERVAL '10 days'),
  (3, 13, 'I have experience in elderly care. What are the requirements?', NOW() - INTERVAL '10 days' + INTERVAL '1 hour'),
  (3, 3, 'She needs help with daily activities and medication reminders.', NOW() - INTERVAL '9 days'),
  (3, 13, 'I can definitely assist with that. I have relevant certifications.', NOW() - INTERVAL '9 days' + INTERVAL '2 hours'),
  (3, 3, 'Please provide your references and certifications.', NOW() - INTERVAL '3 days'),
  
  -- Conversation 4 messages
  (4, 4, 'I need laundry services three times a week. What are your rates?', NOW() - INTERVAL '15 days'),
  (4, 14, 'My rate is 500 pesos per day for laundry services.', NOW() - INTERVAL '15 days' + INTERVAL '4 hours'),
  (4, 4, 'The salary is negotiable based on experience.', NOW() - INTERVAL '5 hours'),
  
  -- Conversation 5 messages
  (5, 5, 'Looking for a kitchen helper for meal preparation. Interested?', NOW() - INTERVAL '3 days'),
  (5, 15, 'Yes! I love cooking and have professional experience.', NOW() - INTERVAL '3 days' + INTERVAL '1 hour'),
  (5, 5, 'What type of cuisine are you familiar with?', NOW() - INTERVAL '2 days'),
  (5, 15, 'I have 5 years of experience in cooking Filipino dishes.', NOW() - INTERVAL '30 minutes'),
  
  -- Conversation 6 messages (RESTRICTED)
  (6, 6, 'I need garden maintenance weekly.', NOW() - INTERVAL '12 days'),
  (6, 16, 'I can help with that. What is your budget?', NOW() - INTERVAL '12 days' + INTERVAL '2 hours'),
  (6, 6, 'This conversation has been restricted due to policy violation.', NOW() - INTERVAL '6 days'),
  
  -- Conversation 7 messages
  (7, 7, 'I need a driver with a clean driving record. Are you available?', NOW() - INTERVAL '8 days'),
  (7, 17, 'Yes, I have a professional driver''s license and 10 years of experience.', NOW() - INTERVAL '8 days' + INTERVAL '1 hour'),
  (7, 7, 'Excellent! What are your availability hours?', NOW() - INTERVAL '7 days'),
  (7, 17, 'I am flexible with my schedule and can work full-time.', NOW() - INTERVAL '7 days' + INTERVAL '3 hours'),
  (7, 7, 'Can we schedule an interview next week?', NOW() - INTERVAL '4 hours'),
  
  -- Conversation 8 messages
  (8, 8, 'I need a general helper for household chores. Interested?', NOW() - INTERVAL '20 days'),
  (8, 18, 'Yes, I am interested. What are the job details?', NOW() - INTERVAL '20 days' + INTERVAL '2 hours'),
  (8, 8, 'General cleaning, laundry, and meal preparation.', NOW() - INTERVAL '19 days'),
  (8, 18, 'That sounds good. I can handle all those tasks.', NOW() - INTERVAL '19 days' + INTERVAL '4 hours'),
  (8, 8, 'I am looking for a live-in worker. Is that okay?', NOW() - INTERVAL '2 days');

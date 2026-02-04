-- Script to add sample worker profiles with skills, certifications, and languages
-- Run this in Supabase SQL Editor

-- First, ensure profile_picture column exists in users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'profile_picture'
    ) THEN
        ALTER TABLE public.users ADD COLUMN profile_picture character varying;
    END IF;
END $$;

-- Make sure we have some base data (skills, certifications, languages)

-- Insert sample skills if they don't exist
INSERT INTO public.skills (name) VALUES
  ('Cooking'),
  ('Cleaning'),
  ('Child Care'),
  ('Elderly Care'),
  ('Laundry'),
  ('Ironing'),
  ('Pet Care'),
  ('Gardening'),
  ('Driver'),
  ('House Management')
ON CONFLICT (name) DO NOTHING;

-- Insert sample certifications if they don't exist
INSERT INTO public.certifications (name) VALUES
  ('First Aid Certificate'),
  ('CPR Certified'),
  ('Child Care Training'),
  ('Elderly Care Training'),
  ('Food Handler Certificate'),
  ('Driving License'),
  ('Housekeeping Certificate')
ON CONFLICT (name) DO NOTHING;

-- Insert sample languages if they don't exist
INSERT INTO public.languages (name) VALUES
  ('English'),
  ('Filipino'),
  ('Tagalog'),
  ('Cebuano'),
  ('Ilocano'),
  ('Spanish'),
  ('Mandarin')
ON CONFLICT (name) DO NOTHING;

-- Insert sample religion if it doesn't exist
INSERT INTO public.religions (name) VALUES
  ('Roman Catholic'),
  ('Protestant'),
  ('Islam'),
  ('Buddhism'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- Create sample addresses for workers
INSERT INTO public.provinces (name) VALUES ('Metro Manila') ON CONFLICT DO NOTHING;
INSERT INTO public.cities (province_id, name) 
SELECT province_id, 'Quezon City' FROM public.provinces WHERE name = 'Metro Manila'
ON CONFLICT DO NOTHING;
INSERT INTO public.barangays (city_id, name)
SELECT city_id, 'Commonwealth' FROM public.cities WHERE name = 'Quezon City'
ON CONFLICT DO NOTHING;

-- Insert sample addresses
INSERT INTO public.addresses (province_id, city_id, barangay_id, street)
SELECT 
  p.province_id, 
  c.city_id, 
  b.barangay_id,
  'Sample Street ' || generate_series(1, 5)
FROM public.provinces p
JOIN public.cities c ON c.province_id = p.province_id
JOIN public.barangays b ON b.city_id = c.city_id
WHERE p.name = 'Metro Manila' AND c.name = 'Quezon City' AND b.barangay_id IS NOT NULL
LIMIT 5;

-- Now insert sample worker users
DO $$
DECLARE
  v_user_id INT;
  v_worker_id INT;
  v_address_id INT;
  v_religion_id INT;
  v_skill_ids INT[];
  v_cert_ids INT[];
  v_lang_ids INT[];
BEGIN
  -- Get religion ID
  SELECT religion_id INTO v_religion_id FROM public.religions WHERE name = 'Roman Catholic' LIMIT 1;
  
  -- Get an address ID
  SELECT address_id INTO v_address_id FROM public.addresses LIMIT 1;
  
  -- Get skill IDs
  SELECT ARRAY_AGG(skill_id) INTO v_skill_ids FROM public.skills LIMIT 5;
  
  -- Get certification IDs
  SELECT ARRAY_AGG(certification_id) INTO v_cert_ids FROM public.certifications LIMIT 3;
  
  -- Get language IDs
  SELECT ARRAY_AGG(language_id) INTO v_lang_ids FROM public.languages WHERE name IN ('English', 'Filipino', 'Tagalog');

  -- Worker 1: Maria Santos
  INSERT INTO public.users (name, email, password, role, address_id, gender, age, birthday, phone_number, status)
  VALUES ('Maria Santos', 'maria.santos@example.com', '$2a$10$dummyhash', 'worker', v_address_id, 'female', 28, '1996-03-15', '+639171234567', 'active')
  RETURNING user_id INTO v_user_id;
  
  INSERT INTO public.workers (user_id, years_experience, bio, religion_id)
  VALUES (v_user_id, 5, 'Experienced housemaid with expertise in cooking and cleaning. Friendly and reliable.', v_religion_id)
  RETURNING worker_id INTO v_worker_id;
  
  -- Add skills for Maria
  INSERT INTO public.worker_skills (worker_id, skill_id)
  SELECT v_worker_id, skill_id FROM public.skills WHERE name IN ('Cooking', 'Cleaning', 'Laundry');
  
  -- Add certifications for Maria
  INSERT INTO public.worker_certifications (worker_id, certification_id)
  SELECT v_worker_id, certification_id FROM public.certifications WHERE name IN ('First Aid Certificate', 'Food Handler Certificate');
  
  -- Add languages for Maria
  INSERT INTO public.worker_languages (worker_id, language_id)
  SELECT v_worker_id, language_id FROM public.languages WHERE name IN ('English', 'Filipino');

  -- Worker 2: John Cruz
  INSERT INTO public.users (name, email, password, role, address_id, gender, age, birthday, phone_number, status)
  VALUES ('John Cruz', 'john.cruz@example.com', '$2a$10$dummyhash', 'worker', v_address_id, 'male', 35, '1989-07-22', '+639181234567', 'active')
  RETURNING user_id INTO v_user_id;
  
  INSERT INTO public.workers (user_id, years_experience, bio, religion_id)
  VALUES (v_user_id, 8, 'Professional driver and handyman with years of experience in household management.', v_religion_id)
  RETURNING worker_id INTO v_worker_id;
  
  INSERT INTO public.worker_skills (worker_id, skill_id)
  SELECT v_worker_id, skill_id FROM public.skills WHERE name IN ('Driver', 'House Management', 'Gardening');
  
  INSERT INTO public.worker_certifications (worker_id, certification_id)
  SELECT v_worker_id, certification_id FROM public.certifications WHERE name IN ('Driving License', 'First Aid Certificate');
  
  INSERT INTO public.worker_languages (worker_id, language_id)
  SELECT v_worker_id, language_id FROM public.languages WHERE name IN ('English', 'Tagalog');

  -- Worker 3: Ana Reyes
  INSERT INTO public.users (name, email, password, role, address_id, gender, age, birthday, phone_number, status)
  VALUES ('Ana Reyes', 'ana.reyes@example.com', '$2a$10$dummyhash', 'worker', v_address_id, 'female', 42, '1982-11-08', '+639191234567', 'active')
  RETURNING user_id INTO v_user_id;
  
  INSERT INTO public.workers (user_id, years_experience, bio, religion_id)
  VALUES (v_user_id, 15, 'Specialized in child care and elderly care. Patient and caring professional.', v_religion_id)
  RETURNING worker_id INTO v_worker_id;
  
  INSERT INTO public.worker_skills (worker_id, skill_id)
  SELECT v_worker_id, skill_id FROM public.skills WHERE name IN ('Child Care', 'Elderly Care', 'Cooking');
  
  INSERT INTO public.worker_certifications (worker_id, certification_id)
  SELECT v_worker_id, certification_id FROM public.certifications WHERE name IN ('Child Care Training', 'Elderly Care Training', 'CPR Certified');
  
  INSERT INTO public.worker_languages (worker_id, language_id)
  SELECT v_worker_id, language_id FROM public.languages WHERE name IN ('English', 'Filipino', 'Cebuano');

  -- Worker 4: Pedro Garcia
  INSERT INTO public.users (name, email, password, role, address_id, gender, age, birthday, phone_number, status)
  VALUES ('Pedro Garcia', 'pedro.garcia@example.com', '$2a$10$dummyhash', 'worker', v_address_id, 'male', 30, '1994-05-19', '+639201234567', 'restricted')
  RETURNING user_id INTO v_user_id;
  
  INSERT INTO public.workers (user_id, years_experience, bio, religion_id)
  VALUES (v_user_id, 4, 'All-around helper with experience in various household tasks.', v_religion_id)
  RETURNING worker_id INTO v_worker_id;
  
  INSERT INTO public.worker_skills (worker_id, skill_id)
  SELECT v_worker_id, skill_id FROM public.skills WHERE name IN ('Cleaning', 'Ironing', 'Pet Care');
  
  INSERT INTO public.worker_certifications (worker_id, certification_id)
  SELECT v_worker_id, certification_id FROM public.certifications WHERE name IN ('Housekeeping Certificate');
  
  INSERT INTO public.worker_languages (worker_id, language_id)
  SELECT v_worker_id, language_id FROM public.languages WHERE name IN ('Filipino', 'Tagalog');

  -- Worker 5: Lisa Fernandez
  INSERT INTO public.users (name, email, password, role, address_id, gender, age, birthday, phone_number, status)
  VALUES ('Lisa Fernandez', 'lisa.fernandez@example.com', '$2a$10$dummyhash', 'worker', v_address_id, 'female', 26, '1998-09-12', '+639211234567', 'banned')
  RETURNING user_id INTO v_user_id;
  
  INSERT INTO public.workers (user_id, years_experience, bio, religion_id)
  VALUES (v_user_id, 3, 'Young and energetic worker specializing in cleaning and laundry services.', v_religion_id)
  RETURNING worker_id INTO v_worker_id;
  
  INSERT INTO public.worker_skills (worker_id, skill_id)
  SELECT v_worker_id, skill_id FROM public.skills WHERE name IN ('Cleaning', 'Laundry', 'Ironing');
  
  INSERT INTO public.worker_certifications (worker_id, certification_id)
  SELECT v_worker_id, certification_id FROM public.certifications WHERE name IN ('Housekeeping Certificate');
  
  INSERT INTO public.worker_languages (worker_id, language_id)
  SELECT v_worker_id, language_id FROM public.languages WHERE name IN ('English', 'Filipino');

  RAISE NOTICE 'Successfully created 5 sample workers with skills, certifications, and languages!';
END $$;

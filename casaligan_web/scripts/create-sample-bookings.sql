-- Create Sample Bookings Data
-- This script creates sample bookings with complete relationships
-- Run this in your Supabase SQL Editor

-- First, let's check if we have the necessary data (workers, employers, packages, schedules)
-- If not, you'll need to create them first

-- Sample data setup:
-- 1. Create sample workers (if they don't exist)
-- 2. Create sample employers (if they don't exist)  
-- 3. Create sample packages
-- 4. Create sample schedules
-- 5. Create sample bookings

BEGIN;

-- ============================================
-- 1. Insert Sample Workers (if not exists)
-- ============================================

-- Worker 1: Joshua Smith
INSERT INTO users (user_id, name, email, password, role, phone_number, gender, age, birthday, status, created_at)
VALUES (101, 'Joshua Smith', 'joshua.smith@gmail.com', 'password123', 'worker', '+63 912 345 6789', 'male', 28, '1997-05-15', 'active', NOW())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO workers (worker_id, user_id, years_experience, bio)
VALUES (101, 101, 5, 'Experienced household worker with expertise in cleaning and cooking.')
ON CONFLICT (worker_id) DO NOTHING;

-- Worker 2: Maria Santos
INSERT INTO users (user_id, name, email, password, role, phone_number, gender, age, birthday, status, created_at)
VALUES (102, 'Maria Santos', 'maria.santos@gmail.com', 'password123', 'worker', '+63 923 456 7890', 'female', 32, '1993-08-20', 'active', NOW())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO workers (worker_id, user_id, years_experience, bio)
VALUES (102, 102, 8, 'Professional housekeeping specialist with childcare experience.')
ON CONFLICT (worker_id) DO NOTHING;

-- Worker 3: Juan Dela Cruz
INSERT INTO users (user_id, name, email, password, role, phone_number, gender, age, birthday, status, created_at)
VALUES (103, 'Juan Dela Cruz', 'juan.delacruz@gmail.com', 'password123', 'worker', '+63 934 567 8901', 'male', 35, '1990-03-10', 'active', NOW())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO workers (worker_id, user_id, years_experience, bio)
VALUES (103, 103, 10, 'Skilled in gardening, maintenance, and general household tasks.')
ON CONFLICT (worker_id) DO NOTHING;

-- ============================================
-- 2. Insert Sample Employers (if not exists)
-- ============================================

-- Employer 1: Marie Jane Cruz
INSERT INTO users (user_id, name, email, password, role, phone_number, gender, age, birthday, status, created_at)
VALUES (201, 'Marie Jane Cruz', 'marie.cruz@gmail.com', 'password123', 'employer', '+63 917 654 3210', 'female', 35, '1990-07-22', 'active', NOW())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO employers (employer_id, user_id, household_size, number_of_children, residence_type, bio)
VALUES (201, 201, 4, 2, 'House', 'Looking for reliable household help for our family.')
ON CONFLICT (employer_id) DO NOTHING;

-- Employer 2: Roberto Garcia
INSERT INTO users (user_id, name, email, password, role, phone_number, gender, age, birthday, status, created_at)
VALUES (202, 'Roberto Garcia', 'roberto.garcia@gmail.com', 'password123', 'employer', '+63 928 765 4321', 'male', 42, '1983-11-30', 'active', NOW())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO employers (employer_id, user_id, household_size, number_of_children, residence_type, bio)
VALUES (202, 202, 3, 1, 'Condominium', 'Busy professional needing help with household tasks.')
ON CONFLICT (employer_id) DO NOTHING;

-- Employer 3: Ana Reyes
INSERT INTO users (user_id, name, email, password, role, phone_number, gender, age, birthday, status, created_at)
VALUES (203, 'Ana Reyes', 'ana.reyes@gmail.com', 'password123', 'employer', '+63 939 876 5432', 'female', 29, '1996-04-18', 'active', NOW())
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO employers (employer_id, user_id, household_size, number_of_children, residence_type, bio)
VALUES (203, 203, 2, 0, 'Apartment', 'Young couple looking for weekly cleaning services.')
ON CONFLICT (employer_id) DO NOTHING;

-- ============================================
-- 3. Create Sample Packages
-- ============================================

-- Package 1: Basic Cleaning by Joshua
INSERT INTO packages (package_id, worker_id, title, description, price, availability, status, created_at)
VALUES (301, 101, 'Basic Home Cleaning', 'Basic home cleaning service including dusting mopping, and basic sanitation of living areas.', 750.00, 'available', 'active', NOW())
ON CONFLICT (package_id) DO NOTHING;

-- Package 2: Deep Cleaning by Maria
INSERT INTO packages (package_id, worker_id, title, description, price, availability, status, created_at)
VALUES (302, 102, 'Deep Cleaning Package', 'Comprehensive deep cleaning including all rooms, kitchen, and bathrooms.', 1200.00, 'available', 'active', NOW())
ON CONFLICT (package_id) DO NOTHING;

-- Package 3: Garden Maintenance by Juan
INSERT INTO packages (package_id, worker_id, title, description, price, availability, status, created_at)
VALUES (303, 103, 'Garden & Yard Maintenance', 'Complete garden care including lawn mowing, trimming, and plant care.', 900.00, 'available', 'active', NOW())
ON CONFLICT (package_id) DO NOTHING;

-- Package 4: Weekly Housekeeping by Maria
INSERT INTO packages (package_id, worker_id, title, description, price, availability, status, created_at)
VALUES (304, 102, 'Weekly Housekeeping', 'Regular weekly housekeeping services for busy families.', 850.00, 'available', 'active', NOW())
ON CONFLICT (package_id) DO NOTHING;

-- Package 5: Full Home Service by Joshua
INSERT INTO packages (package_id, worker_id, title, description, price, availability, status, created_at)
VALUES (305, 101, 'Full Home Service', 'Complete home service including cleaning, laundry, and light cooking.', 1500.00, 'available', 'active', NOW())
ON CONFLICT (package_id) DO NOTHING;

-- ============================================
-- 4. Create Sample Schedules
-- ============================================

-- Schedule 1: Marie Jane Cruz books Joshua's Basic Cleaning for Sept 25, 2025
INSERT INTO schedules (schedule_id, package_id, employer_id, available_date, start_time, end_time, status)
VALUES (401, 301, 201, '2025-09-25', '08:00:00', '12:00:00', 'booked')
ON CONFLICT (schedule_id) DO NOTHING;

-- Schedule 2: Roberto Garcia books Maria's Deep Cleaning for Oct 10, 2025
INSERT INTO schedules (schedule_id, package_id, employer_id, available_date, start_time, end_time, status)
VALUES (402, 302, 202, '2025-10-10', '09:00:00', '15:00:00', 'booked')
ON CONFLICT (schedule_id) DO NOTHING;

-- Schedule 3: Ana Reyes books Juan's Garden Service for Nov 5, 2025
INSERT INTO schedules (schedule_id, package_id, employer_id, available_date, start_time, end_time, status)
VALUES (403, 303, 203, '2025-11-05', '07:00:00', '11:00:00', 'booked')
ON CONFLICT (schedule_id) DO NOTHING;

-- Schedule 4: Marie Jane Cruz books Maria's Weekly Housekeeping for Nov 15, 2025
INSERT INTO schedules (schedule_id, package_id, employer_id, available_date, start_time, end_time, status)
VALUES (404, 304, 201, '2025-11-15', '10:00:00', '14:00:00', 'booked')
ON CONFLICT (schedule_id) DO NOTHING;

-- Schedule 5: Roberto Garcia books Joshua's Full Service for Dec 1, 2025
INSERT INTO schedules (schedule_id, package_id, employer_id, available_date, start_time, end_time, status)
VALUES (405, 305, 202, '2025-12-01', '08:00:00', '17:00:00', 'booked')
ON CONFLICT (schedule_id) DO NOTHING;

-- Schedule 6: Ana Reyes books Maria's Deep Cleaning for Nov 20, 2025
INSERT INTO schedules (schedule_id, package_id, employer_id, available_date, start_time, end_time, status)
VALUES (406, 302, 203, '2025-11-20', '09:00:00', '15:00:00', 'booked')
ON CONFLICT (schedule_id) DO NOTHING;

-- ============================================
-- 5. Create Sample Bookings with Various Statuses
-- ============================================

-- Booking 1: ONGOING - Joshua cleaning for Marie Jane (Sept 25)
INSERT INTO bookings (booking_id, schedule_id, status, booking_date, notes)
VALUES (
    501, 
    401, 
    'confirmed', 
    '2025-09-20 10:30:00', 
    'Please focus on living room and kitchen. Pet-friendly products preferred.'
)
ON CONFLICT (booking_id) DO NOTHING;

-- Booking 2: COMPLETED - Maria's deep cleaning for Roberto (Oct 10)
INSERT INTO bookings (booking_id, schedule_id, status, booking_date, notes)
VALUES (
    502, 
    402, 
    'completed', 
    '2025-10-05 14:20:00', 
    'Great service! Very thorough cleaning.'
)
ON CONFLICT (booking_id) DO NOTHING;

-- Booking 3: CONFIRMED - Juan's garden service for Ana (Nov 5)
INSERT INTO bookings (booking_id, schedule_id, status, booking_date, notes)
VALUES (
    503, 
    403, 
    'confirmed', 
    '2025-11-01 09:15:00', 
    'Please trim the hedges and water the plants.'
)
ON CONFLICT (booking_id) DO NOTHING;

-- Booking 4: PENDING - Maria's weekly housekeeping for Marie Jane (Nov 15)
INSERT INTO bookings (booking_id, schedule_id, status, booking_date, notes)
VALUES (
    504, 
    404, 
    'pending', 
    '2025-11-10 16:45:00', 
    'First time booking, please arrive on time.'
)
ON CONFLICT (booking_id) DO NOTHING;

-- Booking 5: CANCELLED - Joshua's full service for Roberto (Dec 1)
INSERT INTO bookings (booking_id, schedule_id, status, booking_date, notes)
VALUES (
    505, 
    405, 
    'cancelled', 
    '2025-11-12 11:00:00', 
    'Had to cancel due to travel plans. Will reschedule.'
)
ON CONFLICT (booking_id) DO NOTHING;

-- Booking 6: CONFIRMED - Maria's deep cleaning for Ana (Nov 20)
INSERT INTO bookings (booking_id, schedule_id, status, booking_date, notes)
VALUES (
    506, 
    406, 
    'confirmed', 
    '2025-11-15 13:30:00', 
    'Need extra attention to bathroom and kitchen areas.'
)
ON CONFLICT (booking_id) DO NOTHING;

COMMIT;

-- ============================================
-- Verification Query
-- ============================================

-- Check if bookings were created successfully
SELECT 
    b.booking_id,
    b.status,
    b.booking_date,
    u_worker.name AS worker_name,
    u_employer.name AS employer_name,
    p.title AS package_title,
    p.price,
    s.available_date,
    s.start_time,
    s.end_time
FROM bookings b
JOIN schedules s ON b.schedule_id = s.schedule_id
JOIN packages p ON s.package_id = p.package_id
JOIN workers w ON p.worker_id = w.worker_id
JOIN employers e ON s.employer_id = e.employer_id
JOIN users u_worker ON w.user_id = u_worker.user_id
JOIN users u_employer ON e.user_id = u_employer.user_id
WHERE b.booking_id >= 501
ORDER BY b.booking_date DESC;

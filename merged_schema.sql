-- =======================================================
-- CASALIGAN MERGED DATABASE SCHEMA
-- Mobile App + Admin Web Backend (casaligan_web)
-- =======================================================
-- This script merges both database schemas into a unified structure
-- that maintains compatibility with both the mobile app and admin web backend.
--
-- Usage:
--   1. Create a fresh Supabase database or PostgreSQL instance
--   2. Copy and paste this entire script into the Supabase SQL editor
--   3. Execute the script
--   4. Update DATABASE_URL in both backend/.env files
-- =======================================================


-- =======================================================
-- ENUM TYPES
-- =======================================================

-- User status enum (merged from both schemas)
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User role enum (merged - includes all roles from both systems)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'housekeeper', 'employer', 'worker', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Gender enum
DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Document type enum (merged from both)
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM (
        'national_id', 'drivers_license', 'passport',
        'barangay_clearance', 'nbi_clearance', 'police_clearance', 'medical_certificate'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Application status enum
DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Job type enum
DO $$ BEGIN
    CREATE TYPE job_type AS ENUM ('onetime', 'longterm');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Forum post status enum (merged)
DO $$ BEGIN
    CREATE TYPE forumpost_status AS ENUM ('open', 'ongoing', 'pending_completion', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Interest/application status enum
DO $$ BEGIN
    CREATE TYPE interest_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Contract status enum
DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM ('pending', 'active', 'pending_completion', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Direct hire status enum
DO $$ BEGIN
    CREATE TYPE direct_hire_status AS ENUM (
        'pending', 'accepted', 'in_progress', 'pending_completion',
        'completed', 'paid', 'cancelled', 'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Conversation/Convo status enum (merged both names)
DO $$ BEGIN
    CREATE TYPE convo_status AS ENUM ('active', 'read_only', 'archived', 'restricted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Conversation participant role enum
DO $$ BEGIN
    CREATE TYPE conversation_role AS ENUM ('owner', 'participant', 'moderator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Message status enum
DO $$ BEGIN
    CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification type enum (merged)
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'job_application', 'application_accepted', 'application_rejected',
        'job_started', 'completion_submitted', 'completion_approved',
        'payment_sent', 'payment_received', 'payment_due', 'payment_overdue',
        'direct_hire_request', 'direct_hire_accepted', 'direct_hire_rejected',
        'direct_hire_started', 'direct_hire_completed', 'direct_hire_approved', 'direct_hire_paid',
        'system', 'reminder', 'message', 'review', 'booking', 'verification'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report type/status enum
DO $$ BEGIN
    CREATE TYPE report_type AS ENUM (
        'unpaid_job', 'non_completion', 'poor_quality',
        'no_show', 'harassment', 'scam', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_status AS ENUM ('pending', 'under_review', 'resolved', 'dismissed', 'escalated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment frequency enum
DO $$ BEGIN
    CREATE TYPE payment_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment status enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'sent', 'confirmed', 'disputed', 'overdue', 'completed', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Booking status enum
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Schedule status enum
DO $$ BEGIN
    CREATE TYPE schedule_status AS ENUM ('available', 'booked', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Package availability enum
DO $$ BEGIN
    CREATE TYPE package_availability AS ENUM ('available', 'unavailable', 'seasonal');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Package status enum
DO $$ BEGIN
    CREATE TYPE package_status AS ENUM ('pending', 'active', 'inactive', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Verification status enum
DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Refund status enum
DO $$ BEGIN
    CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- =======================================================
-- CORE LOCATION/ADDRESS TABLES
-- =======================================================

-- Provinces table
CREATE TABLE IF NOT EXISTS provinces (
    province_id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    region_code VARCHAR,
    region_name VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_provinces_name ON provinces(name);

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
    city_id SERIAL PRIMARY KEY,
    province_id INTEGER REFERENCES provinces(province_id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    province_code VARCHAR,
    province_name VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_cities_province ON cities(province_id);
CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(name);

-- Barangays table
CREATE TABLE IF NOT EXISTS barangays (
    barangay_id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(city_id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    barangay_code VARCHAR,
    city_name VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_barangays_city ON barangays(city_id);
CREATE INDEX IF NOT EXISTS idx_barangays_name ON barangays(name);

-- Addresses table (merged structure) - foreign key to users added later
CREATE TABLE IF NOT EXISTS addresses (
    address_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE,
    province_id INTEGER REFERENCES provinces(province_id),
    city_id INTEGER REFERENCES cities(city_id),
    barangay_id INTEGER REFERENCES barangays(barangay_id),
    street VARCHAR,
    subdivision VARCHAR,
    zip_code VARCHAR,
    is_current VARCHAR DEFAULT 'true',
    -- Legacy fields for backward compatibility
    region_code VARCHAR,
    region_name VARCHAR,
    province_code VARCHAR,
    province_name VARCHAR,
    city_code VARCHAR,
    city_name VARCHAR,
    barangay_code VARCHAR,
    barangay_name VARCHAR,
    street_address VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_province ON addresses(province_id);
CREATE INDEX IF NOT EXISTS idx_addresses_city ON addresses(city_id);


-- =======================================================
-- USER & PROFILE TABLES
-- =======================================================

-- Users table (merged from both schemas)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL,
    user_id INTEGER GENERATED ALWAYS AS (id) STORED UNIQUE, -- For admin web compatibility
    email VARCHAR UNIQUE NOT NULL,
    phone_number VARCHAR UNIQUE NOT NULL,
    password VARCHAR,
    password_hash TEXT NOT NULL,
    -- Name fields (mobile app style)
    first_name VARCHAR NOT NULL,
    middle_name VARCHAR,
    last_name VARCHAR NOT NULL,
    suffix VARCHAR,
    -- Legacy name field (admin web)
    name VARCHAR GENERATED ALWAYS AS (
        CASE 
            WHEN suffix IS NOT NULL THEN first_name || ' ' || COALESCE(middle_name || ' ', '') || last_name || ' ' || suffix
            ELSE first_name || ' ' || COALESCE(middle_name || ' ', '') || last_name
        END
    ) STORED,
    -- Role fields (supporting both systems)
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    is_housekeeper BOOLEAN NOT NULL DEFAULT FALSE,
    active_role user_role NOT NULL DEFAULT 'owner',
    role user_role NOT NULL DEFAULT 'employer', -- For admin web
    -- Profile fields
    address_id INTEGER REFERENCES addresses(address_id),
    gender gender_type,
    age INTEGER,
    birthday DATE,
    profile_picture VARCHAR,
    id_picture VARCHAR,
    -- Status fields
    status user_status NOT NULL DEFAULT 'pending',
    deleted_at TIMESTAMP WITH TIME ZONE,
    -- Restriction fields (admin web)
    restriction_reason TEXT,
    restricted_at TIMESTAMP WITH TIME ZONE,
    restricted_by_admin_id INTEGER,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add foreign key constraint for addresses.user_id now that users table exists
DO $$ 
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'addresses'
    ) INTO table_exists;
    
    IF table_exists AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'addresses_user_id_fkey'
    ) THEN
        ALTER TABLE addresses ADD CONSTRAINT addresses_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key for restricted_by_admin_id after admins table is created
-- Will be added later in the script


-- =======================================================
-- REFERENCE DATA TABLES
-- =======================================================

-- Languages table
CREATE TABLE IF NOT EXISTS languages (
    language_id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    skill_id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE
);

-- Certifications table
CREATE TABLE IF NOT EXISTS certifications (
    certification_id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE
);

-- Religions table
CREATE TABLE IF NOT EXISTS religions (
    religion_id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE
);


-- =======================================================
-- USER DOCUMENTS & VERIFICATION
-- =======================================================

-- User documents table (mobile app)
CREATE TABLE IF NOT EXISTS user_documents (
    id SERIAL PRIMARY KEY,
    document_id INTEGER GENERATED ALWAYS AS (id) STORED UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    file_path VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'pending',
    notes VARCHAR,
    rejection_reason VARCHAR,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_user_documents_user ON user_documents(user_id);


-- =======================================================
-- ADMIN TABLE
-- =======================================================

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    admin_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    admin_actions VARCHAR
);
CREATE INDEX IF NOT EXISTS idx_admins_user ON admins(user_id);

-- Now add the foreign key constraint for users.restricted_by_admin_id
DO $$ 
DECLARE
    table_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) INTO table_exists;
    
    IF table_exists AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_restricted_by_admin_id_fkey'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_restricted_by_admin_id_fkey 
            FOREIGN KEY (restricted_by_admin_id) REFERENCES admins(admin_id);
    END IF;
END $$;


-- =======================================================
-- WORKER & EMPLOYER TABLES
-- =======================================================

-- Housekeeper applications table (mobile app)
CREATE TABLE IF NOT EXISTS housekeeper_applications (
    application_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status application_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_housekeeper_applications_user ON housekeeper_applications(user_id);

-- Workers table (merged)
CREATE TABLE IF NOT EXISTS workers (
    worker_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    years_experience INTEGER,
    bio TEXT,
    religion_id INTEGER REFERENCES religions(religion_id)
);
CREATE INDEX IF NOT EXISTS idx_workers_user ON workers(user_id);

-- Employers table (merged)
CREATE TABLE IF NOT EXISTS employers (
    employer_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_size INTEGER,
    number_of_children INTEGER,
    residence_type VARCHAR,
    preferences TEXT,
    bio TEXT,
    religion_id INTEGER REFERENCES religions(religion_id)
);
CREATE INDEX IF NOT EXISTS idx_employers_user ON employers(user_id);

-- Worker skills junction table
CREATE TABLE IF NOT EXISTS worker_skills (
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, skill_id)
);

-- Worker certifications junction table
CREATE TABLE IF NOT EXISTS worker_certifications (
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    certification_id INTEGER NOT NULL REFERENCES certifications(certification_id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, certification_id)
);

-- Worker languages junction table
CREATE TABLE IF NOT EXISTS worker_languages (
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    language_id INTEGER NOT NULL REFERENCES languages(language_id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, language_id)
);

-- Employer languages junction table
CREATE TABLE IF NOT EXISTS employer_languages (
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    language_id INTEGER NOT NULL REFERENCES languages(language_id) ON DELETE CASCADE,
    PRIMARY KEY (employer_id, language_id)
);

-- Worker location preferences
CREATE TABLE IF NOT EXISTS worker_location_preferences (
    worker_id INTEGER PRIMARY KEY REFERENCES workers(worker_id) ON DELETE CASCADE,
    max_distance_km NUMERIC,
    only_nearby BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worker preferred cities
CREATE TABLE IF NOT EXISTS worker_preferred_cities (
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    city_id INTEGER NOT NULL REFERENCES cities(city_id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, city_id)
);

-- Favorites workers (employers save favorite workers)
CREATE TABLE IF NOT EXISTS favorites_workers (
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (employer_id, worker_id)
);


-- =======================================================
-- PACKAGES & SERVICES
-- =======================================================

-- Packages table (merged from both admin web and mobile)
CREATE TABLE IF NOT EXISTS packages (
    package_id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    name VARCHAR(100), -- For mobile app compatibility
    description TEXT,
    price NUMERIC NOT NULL,
    duration_hours INTEGER DEFAULT 2,
    services JSONB DEFAULT '[]',
    availability package_availability,
    status package_status NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_packages_worker ON packages(worker_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);

-- Worker packages alias for mobile app compatibility
CREATE OR REPLACE VIEW worker_packages AS 
SELECT 
    package_id,
    worker_id,
    COALESCE(name, title) as name,
    title,
    description,
    price,
    duration_hours,
    services,
    is_active,
    created_at,
    updated_at
FROM packages;


-- =======================================================
-- VERIFICATION TABLES
-- =======================================================

-- Verifications table (admin web)
CREATE TABLE IF NOT EXISTS verifications (
    verification_id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES admins(admin_id),
    document_type VARCHAR NOT NULL,
    document_number VARCHAR,
    file_path VARCHAR,
    status verification_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_verifications_worker ON verifications(worker_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);

-- Verification logs table
CREATE TABLE IF NOT EXISTS verification_logs (
    log_id SERIAL PRIMARY KEY,
    verification_id INTEGER NOT NULL REFERENCES verifications(verification_id) ON DELETE CASCADE,
    admin_id INTEGER REFERENCES admins(admin_id),
    old_status verification_status,
    new_status verification_status NOT NULL,
    reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- =======================================================
-- FORUM/JOB POSTING TABLES
-- =======================================================

-- Forum posts table (merged - supports both job postings and forum discussions)
CREATE TABLE IF NOT EXISTS forumposts (
    post_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    content TEXT,
    description TEXT, -- For admin web compatibility
    category VARCHAR,
    location VARCHAR,
    job_type job_type,
    salary NUMERIC,
    status forumpost_status NOT NULL DEFAULT 'open',
    is_longterm BOOLEAN DEFAULT FALSE,
    start_date VARCHAR,
    end_date VARCHAR,
    payment_frequency VARCHAR,
    payment_amount NUMERIC,
    payment_schedule TEXT,
    completion_proof_url VARCHAR,
    completion_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_forumposts_user ON forumposts(user_id);
CREATE INDEX IF NOT EXISTS idx_forumposts_employer ON forumposts(employer_id);
CREATE INDEX IF NOT EXISTS idx_forumposts_status ON forumposts(status);

-- Forum replies table
CREATE TABLE IF NOT EXISTS forumreplies (
    replies_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES forumposts(post_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_forumreplies_post ON forumreplies(post_id);

-- Interest check table (job applications)
CREATE TABLE IF NOT EXISTS interestcheck (
    interest_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES forumposts(post_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    status interest_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interestcheck_post ON interestcheck(post_id);
CREATE INDEX IF NOT EXISTS idx_interestcheck_worker ON interestcheck(worker_id);


-- =======================================================
-- SCHEDULES & BOOKINGS
-- =======================================================

-- Schedules table (admin web)
CREATE TABLE IF NOT EXISTS schedules (
    schedule_id SERIAL PRIMARY KEY,
    package_id INTEGER NOT NULL REFERENCES packages(package_id) ON DELETE CASCADE,
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    available_date DATE NOT NULL,
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL,
    status schedule_status NOT NULL DEFAULT 'available'
);
CREATE INDEX IF NOT EXISTS idx_schedules_package ON schedules(package_id);
CREATE INDEX IF NOT EXISTS idx_schedules_employer ON schedules(employer_id);

-- Bookings table (admin web)
CREATE TABLE IF NOT EXISTS bookings (
    booking_id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL UNIQUE REFERENCES schedules(schedule_id) ON DELETE CASCADE,
    status booking_status NOT NULL,
    booking_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON bookings(schedule_id);


-- =======================================================
-- CONTRACTS & AGREEMENTS
-- =======================================================

-- Contracts table (merged - supports both mobile and admin web)
CREATE TABLE IF NOT EXISTS contracts (
    contract_id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES forumposts(post_id) ON DELETE CASCADE,
    booking_id INTEGER UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    terms TEXT,
    contract_terms TEXT, -- For mobile app compatibility
    status contract_status NOT NULL DEFAULT 'pending',
    worker_accepted INTEGER DEFAULT 0,
    employer_accepted INTEGER DEFAULT 0,
    completion_proof_url VARCHAR,
    completion_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    payment_proof_url VARCHAR,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_contracts_post ON contracts(post_id);
CREATE INDEX IF NOT EXISTS idx_contracts_booking ON contracts(booking_id);
CREATE INDEX IF NOT EXISTS idx_contracts_worker ON contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employer ON contracts(employer_id);


-- =======================================================
-- DIRECT HIRES
-- =======================================================

-- Direct hires table (mobile app)
CREATE TABLE IF NOT EXISTS direct_hires (
    hire_id SERIAL PRIMARY KEY,
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    package_ids JSONB NOT NULL DEFAULT '[]',
    total_amount NUMERIC(10, 2) NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time VARCHAR(10),
    address_street VARCHAR,
    address_barangay VARCHAR,
    address_city VARCHAR,
    address_province VARCHAR,
    address_region VARCHAR,
    special_instructions TEXT,
    status direct_hire_status NOT NULL DEFAULT 'pending',
    completion_proof_url VARCHAR,
    completion_notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR,
    payment_proof_url VARCHAR,
    reference_number VARCHAR,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_direct_hires_employer ON direct_hires(employer_id);
CREATE INDEX IF NOT EXISTS idx_direct_hires_worker ON direct_hires(worker_id);
CREATE INDEX IF NOT EXISTS idx_direct_hires_status ON direct_hires(status);


-- =======================================================
-- PAYMENTS & TRANSACTIONS
-- =======================================================

-- Payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    method_id SERIAL PRIMARY KEY,
    provider_name VARCHAR NOT NULL,
    details TEXT
);

-- Payments table (admin web)
CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    method_id INTEGER REFERENCES payment_methods(method_id),
    amount NUMERIC NOT NULL,
    status payment_status NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);

-- Payment schedules table (mobile app)
CREATE TABLE IF NOT EXISTS payment_schedules (
    schedule_id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    worker_id INTEGER REFERENCES workers(worker_id),
    worker_name VARCHAR,
    due_date VARCHAR NOT NULL,
    amount NUMERIC NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_contract ON payment_schedules(contract_id);

-- Payment transactions table (mobile app)
CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id SERIAL PRIMARY KEY,
    schedule_id INTEGER UNIQUE NOT NULL REFERENCES payment_schedules(schedule_id) ON DELETE CASCADE,
    amount_paid NUMERIC NOT NULL,
    payment_method VARCHAR,
    payment_proof_url VARCHAR,
    reference_number VARCHAR,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_by_worker BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Refunds table (admin web)
CREATE TABLE IF NOT EXISTS refunds (
    refund_id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    method_id INTEGER NOT NULL REFERENCES payment_methods(method_id),
    amount NUMERIC NOT NULL,
    reason TEXT,
    status refund_status NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_refunds_contract ON refunds(contract_id);


-- =======================================================
-- MESSAGING & CONVERSATIONS
-- =======================================================

-- Conversations table (merged)
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES forumposts(post_id) ON DELETE SET NULL,
    hire_id INTEGER REFERENCES direct_hires(hire_id) ON DELETE SET NULL,
    participant_ids INTEGER[] NOT NULL,
    title VARCHAR(255),
    topic VARCHAR,
    status convo_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message TEXT,
    archived_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    restricted_at TIMESTAMP WITH TIME ZONE,
    restricted_by_admin_id INTEGER REFERENCES admins(admin_id),
    restriction_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participant_ids);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_hire_unique ON conversations(hire_id) WHERE hire_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_job_unique ON conversations(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- Conversation participants table (admin web)
CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INTEGER NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role conversation_role,
    PRIMARY KEY (conversation_id, user_id)
);

-- Messages table (merged)
CREATE TABLE IF NOT EXISTS messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_user_id INTEGER GENERATED ALWAYS AS (sender_id) STORED, -- For admin web compatibility
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    status message_status NOT NULL DEFAULT 'sent',
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);

-- Message attachments table (admin web)
CREATE TABLE IF NOT EXISTS message_attachments (
    attachment_id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    file_path VARCHAR NOT NULL,
    mime_type VARCHAR,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);


-- =======================================================
-- REVIEWS & RATINGS
-- =======================================================

-- Reviews table (merged - admin web structure with mobile app fields)
CREATE TABLE IF NOT EXISTS reviews (
    review_id SERIAL PRIMARY KEY,
    rating_id INTEGER GENERATED ALWAYS AS (review_id) STORED UNIQUE, -- For mobile app compatibility
    contract_id INTEGER UNIQUE REFERENCES contracts(contract_id),
    post_id INTEGER REFERENCES forumposts(post_id) ON DELETE SET NULL,
    hire_id INTEGER REFERENCES direct_hires(hire_id) ON DELETE SET NULL,
    reviewer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rater_id INTEGER GENERATED ALWAYS AS (reviewer_user_id) STORED, -- For mobile app compatibility
    target_user_id INTEGER REFERENCES users(id),
    rated_user_id INTEGER GENERATED ALWAYS AS (target_user_id) STORED, -- For mobile app compatibility
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    stars INTEGER GENERATED ALWAYS AS (rating) STORED, -- For mobile app compatibility
    comment TEXT,
    review TEXT GENERATED ALWAYS AS (comment) STORED, -- For mobile app compatibility
    is_hidden BOOLEAN DEFAULT FALSE,
    hidden_at TIMESTAMP WITH TIME ZONE,
    hidden_by_admin_id INTEGER REFERENCES admins(admin_id),
    warned_at TIMESTAMP WITH TIME ZONE,
    warned_by_admin_id INTEGER REFERENCES admins(admin_id),
    restricted_at TIMESTAMP WITH TIME ZONE,
    restricted_by_admin_id INTEGER REFERENCES admins(admin_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_reviews_contract ON reviews(contract_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_user_id);

-- Ratings view for mobile app compatibility
CREATE OR REPLACE VIEW ratings AS
SELECT 
    rating_id,
    rater_id,
    rated_user_id,
    post_id,
    hire_id,
    stars,
    review,
    created_at
FROM reviews;


-- =======================================================
-- NOTIFICATIONS
-- =======================================================

-- Notifications table (merged)
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    content VARCHAR, -- For admin web compatibility
    entity_type VARCHAR(50),
    entity_id INTEGER,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;


-- =======================================================
-- REPORTS
-- =======================================================

-- Reports table (merged)
CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reporter_user_id INTEGER GENERATED ALWAYS AS (reporter_id) STORED, -- For admin web compatibility
    reporter_role VARCHAR,
    reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    post_id INTEGER REFERENCES forumposts(post_id) ON DELETE SET NULL,
    report_type report_type NOT NULL,
    title VARCHAR NOT NULL,
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT,
    status report_status NOT NULL DEFAULT 'pending',
    admin_id INTEGER REFERENCES users(id),
    resolved_by_admin_id INTEGER REFERENCES admins(admin_id),
    admin_notes TEXT,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);


-- =======================================================
-- MATCHING & ANALYTICS
-- =======================================================

-- Matching records table (admin web)
CREATE TABLE IF NOT EXISTS matching_records (
    match_id SERIAL PRIMARY KEY,
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    package_id INTEGER REFERENCES packages(package_id),
    match_score NUMERIC,
    match_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR NOT NULL DEFAULT 'successful' CHECK (status IN ('successful', 'failed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_matching_records_employer ON matching_records(employer_id);
CREATE INDEX IF NOT EXISTS idx_matching_records_worker ON matching_records(worker_id);

-- Search logs table (admin web)
CREATE TABLE IF NOT EXISTS search_logs (
    search_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query_text VARCHAR,
    filters_json TEXT,
    results_count INTEGER,
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_user ON search_logs(user_id);


-- =======================================================
-- SEQUENCES (for backward compatibility)
-- =======================================================

-- Create sequences for admin web compatibility
DO $$ BEGIN
    CREATE SEQUENCE IF NOT EXISTS addresses_address_id_seq OWNED BY addresses.address_id;
    CREATE SEQUENCE IF NOT EXISTS admins_admin_id_seq OWNED BY admins.admin_id;
    CREATE SEQUENCE IF NOT EXISTS barangays_barangay_id_seq OWNED BY barangays.barangay_id;
    CREATE SEQUENCE IF NOT EXISTS bookings_booking_id_seq OWNED BY bookings.booking_id;
    CREATE SEQUENCE IF NOT EXISTS certifications_certification_id_seq OWNED BY certifications.certification_id;
    CREATE SEQUENCE IF NOT EXISTS cities_city_id_seq OWNED BY cities.city_id;
    CREATE SEQUENCE IF NOT EXISTS contracts_contract_id_seq OWNED BY contracts.contract_id;
    CREATE SEQUENCE IF NOT EXISTS conversations_conversation_id_seq OWNED BY conversations.conversation_id;
    CREATE SEQUENCE IF NOT EXISTS employers_employer_id_seq OWNED BY employers.employer_id;
    CREATE SEQUENCE IF NOT EXISTS forumposts_post_id_seq OWNED BY forumposts.post_id;
    CREATE SEQUENCE IF NOT EXISTS forumreplies_replies_id_seq OWNED BY forumreplies.replies_id;
    CREATE SEQUENCE IF NOT EXISTS interestcheck_interest_id_seq OWNED BY interestcheck.interest_id;
    CREATE SEQUENCE IF NOT EXISTS languages_language_id_seq OWNED BY languages.language_id;
    CREATE SEQUENCE IF NOT EXISTS matching_records_match_id_seq OWNED BY matching_records.match_id;
    CREATE SEQUENCE IF NOT EXISTS message_attachments_attachment_id_seq OWNED BY message_attachments.attachment_id;
    CREATE SEQUENCE IF NOT EXISTS messages_message_id_seq OWNED BY messages.message_id;
    CREATE SEQUENCE IF NOT EXISTS notifications_notification_id_seq OWNED BY notifications.notification_id;
    CREATE SEQUENCE IF NOT EXISTS packages_package_id_seq OWNED BY packages.package_id;
    CREATE SEQUENCE IF NOT EXISTS payment_methods_method_id_seq OWNED BY payment_methods.method_id;
    CREATE SEQUENCE IF NOT EXISTS payments_payment_id_seq OWNED BY payments.payment_id;
    CREATE SEQUENCE IF NOT EXISTS provinces_province_id_seq OWNED BY provinces.province_id;
    CREATE SEQUENCE IF NOT EXISTS refunds_refund_id_seq OWNED BY refunds.refund_id;
    CREATE SEQUENCE IF NOT EXISTS religions_religion_id_seq OWNED BY religions.religion_id;
    CREATE SEQUENCE IF NOT EXISTS reports_report_id_seq OWNED BY reports.report_id;
    CREATE SEQUENCE IF NOT EXISTS reviews_review_id_seq OWNED BY reviews.review_id;
    CREATE SEQUENCE IF NOT EXISTS schedules_schedule_id_seq OWNED BY schedules.schedule_id;
    CREATE SEQUENCE IF NOT EXISTS search_logs_search_id_seq OWNED BY search_logs.search_id;
    CREATE SEQUENCE IF NOT EXISTS skills_skill_id_seq OWNED BY skills.skill_id;
    CREATE SEQUENCE IF NOT EXISTS users_user_id_seq OWNED BY users.id;
    CREATE SEQUENCE IF NOT EXISTS verification_logs_log_id_seq OWNED BY verification_logs.log_id;
    CREATE SEQUENCE IF NOT EXISTS verifications_verification_id_seq OWNED BY verifications.verification_id;
    CREATE SEQUENCE IF NOT EXISTS workers_worker_id_seq OWNED BY workers.worker_id;
END $$;


-- =======================================================
-- ENABLE ROW LEVEL SECURITY (RLS) - OPTIONAL
-- =======================================================
-- Uncomment the following lines if you want to enable RLS on Supabase
-- You'll need to add appropriate RLS policies based on your security requirements

/*
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE forumposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Add your RLS policies here
-- Example:
-- CREATE POLICY "Users can view their own data" ON users
--     FOR SELECT USING (auth.uid() = id::text);
*/


-- =======================================================
-- DONE!
-- =======================================================
-- Your merged database is now ready.
-- 
-- COMPATIBILITY NOTES:
-- 1. Mobile App: Uses 'id' as primary key for users, references users(id)
-- 2. Admin Web: Uses 'user_id' field which is generated from 'id'
-- 3. Both systems share the same tables with compatible field names
-- 4. Views and generated columns provide backward compatibility
-- 
-- NEXT STEPS:
-- 1. Update backend/.env in both folders with your Supabase DATABASE_URL
-- 2. Test mobile app endpoints
-- 3. Test admin web endpoints
-- 4. Verify data migration if you have existing data
-- =======================================================

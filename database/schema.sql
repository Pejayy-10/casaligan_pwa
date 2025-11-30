-- =======================================================
-- CASALIGAN DATABASE SCHEMA
-- =======================================================
-- Run this script on a fresh PostgreSQL database (e.g., Supabase)
-- to create all required tables and types.
--
-- Usage:
--   1. Create a new PostgreSQL database
--   2. Run this script
--   3. Update your backend/.env with the new DATABASE_URL
-- =======================================================


-- =======================================================
-- ENUM TYPES
-- =======================================================

-- User status enum
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'housekeeper');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Document type enum
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

-- Forum post status enum
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

-- Conversation status enum
DO $$ BEGIN
    CREATE TYPE conversation_status AS ENUM ('active', 'read_only', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Notification type enum
DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'job_application', 'application_accepted', 'application_rejected',
        'job_started', 'completion_submitted', 'completion_approved',
        'payment_sent', 'payment_received', 'payment_due', 'payment_overdue',
        'direct_hire_request', 'direct_hire_accepted', 'direct_hire_rejected',
        'direct_hire_started', 'direct_hire_completed', 'direct_hire_approved', 'direct_hire_paid',
        'system', 'reminder'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report type enum
DO $$ BEGIN
    CREATE TYPE report_type AS ENUM (
        'unpaid_job', 'non_completion', 'poor_quality',
        'no_show', 'harassment', 'scam', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Report status enum
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
    CREATE TYPE payment_status AS ENUM ('pending', 'sent', 'confirmed', 'disputed', 'overdue');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- =======================================================
-- TABLES
-- =======================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    phone_number VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    first_name VARCHAR NOT NULL,
    middle_name VARCHAR,
    last_name VARCHAR NOT NULL,
    suffix VARCHAR,
    is_owner BOOLEAN NOT NULL DEFAULT TRUE,
    is_housekeeper BOOLEAN NOT NULL DEFAULT FALSE,
    active_role user_role NOT NULL DEFAULT 'owner',
    status user_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);


-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    region_code VARCHAR,
    region_name VARCHAR NOT NULL,
    province_code VARCHAR,
    province_name VARCHAR NOT NULL,
    city_code VARCHAR,
    city_name VARCHAR NOT NULL,
    barangay_code VARCHAR,
    barangay_name VARCHAR NOT NULL,
    street_address VARCHAR,
    subdivision VARCHAR,
    zip_code VARCHAR,
    is_current VARCHAR DEFAULT 'true'
);


-- User documents table
CREATE TABLE IF NOT EXISTS user_documents (
    id SERIAL PRIMARY KEY,
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


-- Housekeeper applications table
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


-- Workers table
CREATE TABLE IF NOT EXISTS workers (
    worker_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workers_user ON workers(user_id);


-- Employers table
CREATE TABLE IF NOT EXISTS employers (
    employer_id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employers_user ON employers(user_id);


-- Worker packages table
CREATE TABLE IF NOT EXISTS worker_packages (
    package_id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    duration_hours INTEGER NOT NULL DEFAULT 2,
    services JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_worker_packages_worker ON worker_packages(worker_id);


-- Forum posts (jobs) table
CREATE TABLE IF NOT EXISTS forumposts (
    post_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    content TEXT NOT NULL,
    location VARCHAR NOT NULL,
    job_type job_type NOT NULL,
    salary NUMERIC NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_forumposts_employer ON forumposts(employer_id);
CREATE INDEX IF NOT EXISTS idx_forumposts_status ON forumposts(status);


-- Interest check (job applications) table
CREATE TABLE IF NOT EXISTS interestcheck (
    interest_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES forumposts(post_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    status interest_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interestcheck_post ON interestcheck(post_id);
CREATE INDEX IF NOT EXISTS idx_interestcheck_worker ON interestcheck(worker_id);


-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    contract_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES forumposts(post_id) ON DELETE CASCADE,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    employer_id INTEGER NOT NULL REFERENCES employers(employer_id) ON DELETE CASCADE,
    contract_terms TEXT,
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
CREATE INDEX IF NOT EXISTS idx_contracts_worker ON contracts(worker_id);


-- Direct hires table
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


-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES forumposts(post_id) ON DELETE SET NULL,
    hire_id INTEGER REFERENCES direct_hires(hire_id) ON DELETE SET NULL,
    participant_ids INTEGER[] NOT NULL,
    title VARCHAR(255),
    status conversation_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participant_ids);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_hire_unique ON conversations(hire_id) WHERE hire_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_job_unique ON conversations(job_id) WHERE job_id IS NOT NULL;


-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);


-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
    rating_id SERIAL PRIMARY KEY,
    rater_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES forumposts(post_id) ON DELETE SET NULL,
    hire_id INTEGER REFERENCES direct_hires(hire_id) ON DELETE SET NULL,
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ratings_rater ON ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_user_id);


-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;


-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reporter_role VARCHAR NOT NULL,
    reported_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    post_id INTEGER REFERENCES forumposts(post_id) ON DELETE SET NULL,
    report_type report_type NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT,
    status report_status NOT NULL DEFAULT 'pending',
    admin_id INTEGER REFERENCES users(id),
    admin_notes TEXT,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);


-- Payment schedules table
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


-- Payment transactions table
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


-- =======================================================
-- DONE!
-- =======================================================
-- Your database is now ready.
-- Update your backend/.env file with the DATABASE_URL and restart the server.
-- =======================================================

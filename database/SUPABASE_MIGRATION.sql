-- =====================================================
-- SUPABASE MIGRATION: Recurring Schedule & Availability Calendar
-- =====================================================
-- Copy and paste this entire file into Supabase SQL Editor
-- This migration is safe to run multiple times (uses IF NOT EXISTS)
-- =====================================================

-- =====================================================
-- PART 1: Add Recurring Schedule Fields to direct_hires
-- =====================================================

DO $$ 
BEGIN
  -- Add is_recurring column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'is_recurring') THEN
    ALTER TABLE public.direct_hires ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;

  -- Add day_of_week column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'day_of_week') THEN
    ALTER TABLE public.direct_hires ADD COLUMN day_of_week character varying(20);
  END IF;

  -- Add start_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'start_time') THEN
    ALTER TABLE public.direct_hires ADD COLUMN start_time character varying(10);
  END IF;

  -- Add end_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'end_time') THEN
    ALTER TABLE public.direct_hires ADD COLUMN end_time character varying(10);
  END IF;

  -- Add frequency column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'frequency') THEN
    ALTER TABLE public.direct_hires ADD COLUMN frequency character varying(20);
  END IF;

  -- Add recurring_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'recurring_status') THEN
    ALTER TABLE public.direct_hires ADD COLUMN recurring_status character varying(20) DEFAULT 'active';
  END IF;

  -- Add recurring_cancelled_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'recurring_cancelled_at') THEN
    ALTER TABLE public.direct_hires ADD COLUMN recurring_cancelled_at timestamp with time zone;
  END IF;

  -- Add recurring_cancellation_reason column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'recurring_cancellation_reason') THEN
    ALTER TABLE public.direct_hires ADD COLUMN recurring_cancellation_reason text;
  END IF;

  -- Add cancelled_by column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'direct_hires' 
                 AND column_name = 'cancelled_by') THEN
    ALTER TABLE public.direct_hires ADD COLUMN cancelled_by character varying(20);
  END IF;
END $$;

-- =====================================================
-- PART 2: Add Recurring Schedule Fields to forumposts
-- =====================================================

DO $$ 
BEGIN
  -- Add is_recurring column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'is_recurring') THEN
    ALTER TABLE public.forumposts ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;

  -- Add day_of_week column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'day_of_week') THEN
    ALTER TABLE public.forumposts ADD COLUMN day_of_week character varying(20);
  END IF;

  -- Add start_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'start_time') THEN
    ALTER TABLE public.forumposts ADD COLUMN start_time character varying(10);
  END IF;

  -- Add end_time column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'end_time') THEN
    ALTER TABLE public.forumposts ADD COLUMN end_time character varying(10);
  END IF;

  -- Add frequency column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'frequency') THEN
    ALTER TABLE public.forumposts ADD COLUMN frequency character varying(20);
  END IF;

  -- Add recurring_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'recurring_status') THEN
    ALTER TABLE public.forumposts ADD COLUMN recurring_status character varying(20) DEFAULT 'active';
  END IF;

  -- Add recurring_cancelled_at column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'recurring_cancelled_at') THEN
    ALTER TABLE public.forumposts ADD COLUMN recurring_cancelled_at timestamp with time zone;
  END IF;

  -- Add recurring_cancellation_reason column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'recurring_cancellation_reason') THEN
    ALTER TABLE public.forumposts ADD COLUMN recurring_cancellation_reason text;
  END IF;

  -- Add cancelled_by column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'forumposts' 
                 AND column_name = 'cancelled_by') THEN
    ALTER TABLE public.forumposts ADD COLUMN cancelled_by character varying(20);
  END IF;
END $$;

-- =====================================================
-- PART 3: Create worker_blocked_dates table
-- =====================================================

-- Create sequence first
CREATE SEQUENCE IF NOT EXISTS public.worker_blocked_dates_blocked_date_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create the table
CREATE TABLE IF NOT EXISTS public.worker_blocked_dates (
  blocked_date_id integer NOT NULL DEFAULT nextval('public.worker_blocked_dates_blocked_date_id_seq'::regclass),
  worker_id integer NOT NULL,
  blocked_date date NOT NULL,
  reason character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT worker_blocked_dates_pkey PRIMARY KEY (blocked_date_id),
  CONSTRAINT worker_blocked_dates_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id) ON DELETE CASCADE
);

-- Set sequence owner
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'worker_blocked_dates_blocked_date_id_seq') THEN
    ALTER SEQUENCE public.worker_blocked_dates_blocked_date_id_seq OWNED BY public.worker_blocked_dates.blocked_date_id;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_blocked_dates_worker_id 
  ON public.worker_blocked_dates(worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_blocked_dates_blocked_date 
  ON public.worker_blocked_dates(blocked_date);

CREATE INDEX IF NOT EXISTS idx_worker_blocked_dates_worker_date 
  ON public.worker_blocked_dates(worker_id, blocked_date);

-- Create unique constraint to prevent duplicate blocked dates
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_blocked_dates_unique 
  ON public.worker_blocked_dates(worker_id, blocked_date);

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- Summary:
-- ✅ Added 9 recurring schedule columns to direct_hires
-- ✅ Added 9 recurring schedule columns to forumposts  
-- ✅ Created worker_blocked_dates table with indexes
-- 
-- All changes are safe and won't affect existing data.
-- =====================================================


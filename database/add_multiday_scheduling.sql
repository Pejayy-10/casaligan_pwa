-- ============================================================
-- Multi-Day Job Scheduling & Daily Completion Confirmation
-- ============================================================
-- Adds support for:
--   • Multi-day jobs with daily start_time / end_time
--   • A per-day schedule table (job_day_schedules)
--   • A per-day completion confirmation table (daily_completions)
--   • New columns on forumposts & direct_hires for daily time windows
-- ============================================================

-- 1. Add daily time-range columns to forumposts (for non-recurring short-term jobs)
ALTER TABLE public.forumposts
  ADD COLUMN IF NOT EXISTS num_days integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS daily_start_time character varying(10),  -- e.g. "08:00"
  ADD COLUMN IF NOT EXISTS daily_end_time character varying(10);    -- e.g. "15:00"

-- 2. Add daily time-range columns to direct_hires
ALTER TABLE public.direct_hires
  ADD COLUMN IF NOT EXISTS num_days integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS daily_start_time character varying(10),
  ADD COLUMN IF NOT EXISTS daily_end_time character varying(10),
  ADD COLUMN IF NOT EXISTS end_date date;  -- computed as scheduled_date + num_days - 1

-- 3. Per-day schedule table – one row per working day of a multi-day job
CREATE TABLE IF NOT EXISTS public.job_day_schedules (
  day_schedule_id serial PRIMARY KEY,
  -- polymorphic reference: exactly one of these should be non-null
  post_id integer REFERENCES public.forumposts(post_id) ON DELETE CASCADE,
  hire_id integer REFERENCES public.direct_hires(hire_id) ON DELETE CASCADE,
  -- which worker (useful for multi-worker job posts)
  worker_id integer NOT NULL REFERENCES public.workers(worker_id),
  -- the calendar date for this working day
  work_date date NOT NULL,
  -- time window
  start_time character varying(10) NOT NULL,  -- "08:00"
  end_time character varying(10) NOT NULL,    -- "15:00"
  -- day number within the job (1, 2, 3 …)
  day_number integer NOT NULL DEFAULT 1,
  -- status of this specific day
  status character varying(30) NOT NULL DEFAULT 'pending',
  -- CHECK (status IN ('pending','in_progress','pending_completion','completed','skipped')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_jds_post ON public.job_day_schedules(post_id);
CREATE INDEX IF NOT EXISTS idx_jds_hire ON public.job_day_schedules(hire_id);
CREATE INDEX IF NOT EXISTS idx_jds_worker_date ON public.job_day_schedules(worker_id, work_date);

-- 4. Daily completion confirmation table
-- Both owner and housekeeper must confirm each day's work
CREATE TABLE IF NOT EXISTS public.daily_completions (
  completion_id serial PRIMARY KEY,
  day_schedule_id integer NOT NULL REFERENCES public.job_day_schedules(day_schedule_id) ON DELETE CASCADE,
  -- who confirmed
  confirmed_by integer NOT NULL REFERENCES public.users(id),
  role character varying(20) NOT NULL,  -- 'owner' or 'housekeeper'
  -- CHECK (role IN ('owner','housekeeper')),
  -- proof / notes
  proof_url character varying,
  notes text,
  confirmed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dc_schedule ON public.daily_completions(day_schedule_id);

-- 5. Add notification types for daily completion (safe to re-run)
-- These will be handled by the Python enum; this is for documentation only.
-- DAILY_COMPLETION_SUBMITTED = "daily_completion_submitted"
-- DAILY_COMPLETION_CONFIRMED = "daily_completion_confirmed"
-- DAILY_ALL_CONFIRMED        = "daily_all_confirmed"

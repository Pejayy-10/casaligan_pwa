-- Add restriction_reason field to users table
-- This allows storing the reason when an employer or worker is restricted

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS restriction_reason text,
ADD COLUMN IF NOT EXISTS restricted_at timestamp without time zone,
ADD COLUMN IF NOT EXISTS restricted_by_admin_id integer;

-- Add foreign key constraint for restricted_by_admin_id
ALTER TABLE public.users
ADD CONSTRAINT users_restricted_by_admin_id_fkey 
  FOREIGN KEY (restricted_by_admin_id) REFERENCES public.admins(admin_id);

-- Create index for faster queries on restricted users
CREATE INDEX IF NOT EXISTS idx_users_restricted_at ON public.users(restricted_at);
CREATE INDEX IF NOT EXISTS idx_users_restricted_by_admin ON public.users(restricted_by_admin_id);


-- Create matching_records table to track employer-worker matches
CREATE TABLE IF NOT EXISTS public.matching_records (
  match_id SERIAL PRIMARY KEY,
  employer_id INTEGER NOT NULL,
  worker_id INTEGER NOT NULL,
  package_id INTEGER,
  match_score NUMERIC(5,2),
  match_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'successful',
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT matching_records_employer_id_fkey 
    FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id),
  CONSTRAINT matching_records_worker_id_fkey 
    FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id),
  CONSTRAINT matching_records_package_id_fkey 
    FOREIGN KEY (package_id) REFERENCES public.packages(package_id),
  CONSTRAINT matching_records_status_check 
    CHECK (status IN ('successful', 'failed'))
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_matching_records_employer ON public.matching_records(employer_id);
CREATE INDEX IF NOT EXISTS idx_matching_records_worker ON public.matching_records(worker_id);
CREATE INDEX IF NOT EXISTS idx_matching_records_date ON public.matching_records(match_date);
CREATE INDEX IF NOT EXISTS idx_matching_records_status ON public.matching_records(status);

-- Add to txt schema file for reference
COMMENT ON TABLE public.matching_records IS 'Tracks employer-worker matching records for analytics';

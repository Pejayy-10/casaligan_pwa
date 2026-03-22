-- Portfolio photos table for housekeeper credentials/showcase
-- Allows housekeepers to upload photos of credentials, before/after work, certifications, etc.

CREATE TABLE IF NOT EXISTS portfolio_photos (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
    image_url VARCHAR NOT NULL,
    caption VARCHAR(255),
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    -- Categories: 'before_after', 'credentials', 'certification', 'work_sample', 'general'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by worker
CREATE INDEX IF NOT EXISTS idx_portfolio_photos_worker_id ON portfolio_photos(worker_id);

-- Migration: Add reports table for disputes and complaints
-- Run this on your Neon database

CREATE TABLE IF NOT EXISTS reports (
    report_id SERIAL PRIMARY KEY,
    
    -- Who submitted the report
    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reporter_role VARCHAR(50) NOT NULL,
    
    -- Who is being reported (optional)
    reported_user_id INTEGER REFERENCES users(id),
    
    -- Related job (optional)
    post_id INTEGER REFERENCES forumposts(post_id),
    
    -- Report details
    report_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Evidence/proof (JSON array of URLs)
    evidence_urls TEXT,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Admin handling
    admin_id INTEGER REFERENCES users(id),
    admin_notes TEXT,
    resolution TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_post ON reports(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);

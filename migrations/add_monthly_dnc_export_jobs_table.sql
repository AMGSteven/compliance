-- Create table to track monthly DNC export job processing
CREATE TABLE IF NOT EXISTS monthly_dnc_export_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    filters JSONB DEFAULT '{}',
    
    -- Job timing
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Results summary
    total_lists_processed INTEGER DEFAULT 0,
    total_leads_found INTEGER DEFAULT 0,
    total_dnc_matches INTEGER DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_dnc_export_jobs_status 
ON monthly_dnc_export_jobs (status);

CREATE INDEX IF NOT EXISTS idx_monthly_dnc_export_jobs_year_month 
ON monthly_dnc_export_jobs (year, month);

CREATE INDEX IF NOT EXISTS idx_monthly_dnc_export_jobs_created_at 
ON monthly_dnc_export_jobs (created_at);

-- Add RLS policies
ALTER TABLE monthly_dnc_export_jobs ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY IF NOT EXISTS "Allow read access to monthly DNC export jobs" 
ON monthly_dnc_export_jobs FOR SELECT 
USING (true);

-- Allow insert/update for system operations
CREATE POLICY IF NOT EXISTS "Allow insert/update for monthly DNC export jobs" 
ON monthly_dnc_export_jobs FOR ALL 
USING (true);

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_monthly_dnc_export_jobs_updated_at 
    BEFORE UPDATE ON monthly_dnc_export_jobs 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create table to store monthly DNC export results
CREATE TABLE IF NOT EXISTS monthly_dnc_exports (
    id SERIAL PRIMARY KEY,
    list_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    total_leads INTEGER NOT NULL DEFAULT 0,
    dnc_matches INTEGER NOT NULL DEFAULT 0,
    csv_data TEXT,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one record per list_id/year/month combination
    CONSTRAINT unique_monthly_dnc_export UNIQUE (list_id, year, month)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_monthly_dnc_exports_list_year_month 
ON monthly_dnc_exports (list_id, year, month);

CREATE INDEX IF NOT EXISTS idx_monthly_dnc_exports_processed_at 
ON monthly_dnc_exports (processed_at);

-- Add RLS policies if needed
ALTER TABLE monthly_dnc_exports ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY IF NOT EXISTS "Allow read access to monthly DNC exports" 
ON monthly_dnc_exports FOR SELECT 
USING (true);

-- Allow insert/update for system operations
CREATE POLICY IF NOT EXISTS "Allow insert/update for monthly DNC exports" 
ON monthly_dnc_exports FOR ALL 
USING (true);

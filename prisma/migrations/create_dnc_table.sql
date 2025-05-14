-- Create DNC entries table
CREATE TABLE IF NOT EXISTS dnc_entries (
    phone_number TEXT PRIMARY KEY,
    date_added TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    source TEXT NOT NULL,
    added_by TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    expiration_date TIMESTAMP WITH TIME ZONE,
    CONSTRAINT dnc_entries_phone_number_key UNIQUE (phone_number)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS dnc_entries_status_idx ON dnc_entries(status);
CREATE INDEX IF NOT EXISTS dnc_entries_date_added_idx ON dnc_entries(date_added);

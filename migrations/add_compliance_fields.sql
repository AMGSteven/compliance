-- Migration to add additional required compliance fields
DO $$ 
BEGIN
    -- Add age_range column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'leads' AND column_name = 'age_range') THEN
        ALTER TABLE leads ADD COLUMN age_range TEXT;
    END IF;
    
    -- Add state column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'leads' AND column_name = 'state') THEN
        ALTER TABLE leads ADD COLUMN state TEXT;
    END IF;
    
    -- Create index for performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE tablename = 'leads' AND indexname = 'idx_leads_state') THEN
        CREATE INDEX idx_leads_state ON leads(state);
    END IF;
END $$;

-- Add a comment to document the purpose of this migration
COMMENT ON COLUMN leads.age_range IS 'Age range of the lead for compliance purposes';
COMMENT ON COLUMN leads.state IS 'State where the lead is located, required for compliance';

-- Migration to add comprehensive health insurance lead fields
DO $$ 
BEGIN
    -- Add basic lead fields if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'api_token') THEN
        ALTER TABLE leads ADD COLUMN api_token TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'vertical') THEN
        ALTER TABLE leads ADD COLUMN vertical TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'sub_id') THEN
        ALTER TABLE leads ADD COLUMN sub_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'user_agent') THEN
        ALTER TABLE leads ADD COLUMN user_agent TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'original_url') THEN
        ALTER TABLE leads ADD COLUMN original_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'jornaya_lead_id') THEN
        ALTER TABLE leads ADD COLUMN jornaya_lead_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'session_length') THEN
        ALTER TABLE leads ADD COLUMN session_length TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'tcpa_text') THEN
        ALTER TABLE leads ADD COLUMN tcpa_text TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'verify_address') THEN
        ALTER TABLE leads ADD COLUMN verify_address BOOLEAN;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'original_creation_date') THEN
        ALTER TABLE leads ADD COLUMN original_creation_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'site_license_number') THEN
        ALTER TABLE leads ADD COLUMN site_license_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'ip_address') THEN
        ALTER TABLE leads ADD COLUMN ip_address TEXT;
    END IF;
    
    -- Add Contact Data fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'day_phone_number') THEN
        ALTER TABLE leads ADD COLUMN day_phone_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'residence_type') THEN
        ALTER TABLE leads ADD COLUMN residence_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'years_at_residence') THEN
        ALTER TABLE leads ADD COLUMN years_at_residence TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'months_at_residence') THEN
        ALTER TABLE leads ADD COLUMN months_at_residence TEXT;
    END IF;
    
    -- Add Person Data fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'birth_date') THEN
        ALTER TABLE leads ADD COLUMN birth_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'gender') THEN
        ALTER TABLE leads ADD COLUMN gender TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'marital_status') THEN
        ALTER TABLE leads ADD COLUMN marital_status TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'relationship_to_applicant') THEN
        ALTER TABLE leads ADD COLUMN relationship_to_applicant TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'denied_insurance') THEN
        ALTER TABLE leads ADD COLUMN denied_insurance TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'us_residence') THEN
        ALTER TABLE leads ADD COLUMN us_residence BOOLEAN;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'height_ft') THEN
        ALTER TABLE leads ADD COLUMN height_ft TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'height_inch') THEN
        ALTER TABLE leads ADD COLUMN height_inch TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'weight') THEN
        ALTER TABLE leads ADD COLUMN weight TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'student') THEN
        ALTER TABLE leads ADD COLUMN student BOOLEAN;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'occupation') THEN
        ALTER TABLE leads ADD COLUMN occupation TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'education') THEN
        ALTER TABLE leads ADD COLUMN education TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'house_hold_income') THEN
        ALTER TABLE leads ADD COLUMN house_hold_income TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'house_hold_size') THEN
        ALTER TABLE leads ADD COLUMN house_hold_size TEXT;
    END IF;
    
    -- Add Medical Conditions as JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'conditions') THEN
        ALTER TABLE leads ADD COLUMN conditions JSONB;
    END IF;
    
    -- Add Medical History as JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'medical_history') THEN
        ALTER TABLE leads ADD COLUMN medical_history JSONB;
    END IF;
    
    -- Add Insurance Information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'coverage_type') THEN
        ALTER TABLE leads ADD COLUMN coverage_type TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'insurance_company') THEN
        ALTER TABLE leads ADD COLUMN insurance_company TEXT;
    END IF;
    
    -- Create indexes for performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'leads' AND indexname = 'idx_leads_api_token') THEN
        CREATE INDEX idx_leads_api_token ON leads(api_token);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'leads' AND indexname = 'idx_leads_jornaya_lead_id') THEN
        CREATE INDEX idx_leads_jornaya_lead_id ON leads(jornaya_lead_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'leads' AND indexname = 'idx_leads_birth_date') THEN
        CREATE INDEX idx_leads_birth_date ON leads(birth_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'leads' AND indexname = 'idx_leads_coverage_type') THEN
        CREATE INDEX idx_leads_coverage_type ON leads(coverage_type);
    END IF;
END $$;

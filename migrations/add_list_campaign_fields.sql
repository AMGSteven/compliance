-- Safe migration to add list_id, campaign_id, and traffic_source columns to the leads table
-- This can be safely run on production

-- Step 1: Check if the columns already exist before trying to add them
DO $$ 
BEGIN
    -- Add list_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'list_id') THEN
        ALTER TABLE leads ADD COLUMN list_id TEXT;
    END IF;
    
    -- Add campaign_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'campaign_id') THEN
        ALTER TABLE leads ADD COLUMN campaign_id TEXT;
    END IF;
    
    -- Add traffic_source column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'traffic_source') THEN
        ALTER TABLE leads ADD COLUMN traffic_source TEXT;
    END IF;
    
    -- Create indexes for faster queries if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'leads' AND indexname = 'idx_leads_list_campaign') THEN
        CREATE INDEX idx_leads_list_campaign ON leads(list_id, campaign_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'leads' AND indexname = 'idx_leads_traffic_source') THEN
        CREATE INDEX idx_leads_traffic_source ON leads(traffic_source);
    END IF;
END $$;

-- Step 2: Copy existing values from metadata JSON field if they exist there
UPDATE leads
SET 
    list_id = metadata->>'list_id',
    campaign_id = metadata->>'campaign_id',
    traffic_source = metadata->>'traffic_source'
WHERE 
    metadata IS NOT NULL 
    AND (metadata->>'list_id' IS NOT NULL OR metadata->>'campaign_id' IS NOT NULL OR metadata->>'traffic_source' IS NOT NULL) 
    AND (list_id IS NULL OR campaign_id IS NULL OR traffic_source IS NULL);

-- Step 3: Set default values for existing records without these values
UPDATE leads
SET 
    list_id = COALESCE(list_id, 'legacy_list'),
    campaign_id = COALESCE(campaign_id, 'legacy_campaign')
WHERE 
    list_id IS NULL OR campaign_id IS NULL;
    
-- Step 4: Set traffic_source based on list_id mapping
UPDATE leads
SET 
    traffic_source = CASE
        WHEN list_id = '1b759535-2a5e-421e-9371-3bde7f855c60' THEN 'Onpoint'
        WHEN list_id = 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e' THEN 'Juiced'
        ELSE traffic_source
    END
WHERE 
    traffic_source IS NULL
    AND list_id IS NOT NULL;

-- NOTE: We're not making these fields NOT NULL to maintain compatibility
-- with existing code. The API validation will ensure new leads have these values.

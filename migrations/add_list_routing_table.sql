-- Migration to create a table for mapping list IDs to campaign and cadence IDs

-- Check if the table already exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'list_routings') THEN
    
    -- Create the list_routings table
    CREATE TABLE list_routings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      list_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      cadence_id TEXT NOT NULL,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create indexes for faster lookups
    CREATE INDEX idx_list_routings_list_id ON list_routings(list_id);
    CREATE UNIQUE INDEX idx_list_routings_unique ON list_routings(list_id) WHERE active = true;
    
    -- Add some sample data
    INSERT INTO list_routings (list_id, campaign_id, cadence_id, description)
    VALUES 
      ('a38881ab-93b2-4750-9f9c-92ae6cd10b7e', 'b2c3d4e5-f6a1-4a1a-bde0-1a733c8d1c00', 'cdf8d4d8-d42e-48a2-ae73-d2232e2cc5a7', 'Juiced Media Default Routing'),
      ('1b759535-2a5e-421e-9371-3bde7f855c60', 'healthcare_2025_q2', '39a9381e-14ef-4fdd-a95a-9649025590a4', 'Onpoint Health Insurance Routing');
      
    RAISE NOTICE 'Created list_routings table and added sample data';
  ELSE
    RAISE NOTICE 'list_routings table already exists';
  END IF;
END
$$;

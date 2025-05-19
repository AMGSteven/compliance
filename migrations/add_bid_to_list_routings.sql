-- Migration to add bid field to list_routings table
-- This bid will be returned to the buyer on successful lead submissions

-- Add the bid column if it doesn't exist
DO $$ 
BEGIN
    -- Add bid column as a numeric type (for decimal values) with default 0
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'list_routings' AND column_name = 'bid') THEN
        ALTER TABLE list_routings ADD COLUMN bid NUMERIC(10, 2) DEFAULT 0.00;
        
        -- Add comment to the column for documentation
        COMMENT ON COLUMN list_routings.bid IS 'The bid amount to return to the buyer on successful lead submissions';
        
        -- Update existing records with default bid values
        UPDATE list_routings
        SET bid = 
            CASE 
                WHEN list_id = '1b759535-2a5e-421e-9371-3bde7f855c60' THEN 2.50  -- Onpoint default bid
                WHEN list_id = 'a38881ab-93b2-4750-9f9c-92ae6cd10b7e' THEN 3.00  -- Juiced default bid
                ELSE 1.00  -- Default for other lists
            END;
        
        RAISE NOTICE 'Added bid column to list_routings table';
    ELSE
        RAISE NOTICE 'bid column already exists in list_routings table';
    END IF;
END $$;

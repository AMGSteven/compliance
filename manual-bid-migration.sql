-- Manual Migration: Add bid_amount column to leads table
-- Run this SQL in your Supabase dashboard SQL editor

-- Check if column already exists (this will show results if it exists)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' AND column_name = 'bid_amount';

-- Add the bid_amount column (will skip if already exists)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS bid_amount DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN leads.bid_amount IS 'Historical bid amount at time of lead submission';

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_bid_amount ON leads(bid_amount);
CREATE INDEX IF NOT EXISTS idx_leads_list_bid ON leads(list_id, bid_amount);
CREATE INDEX IF NOT EXISTS idx_leads_bid_created ON leads(bid_amount, created_at);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'leads' AND column_name = 'bid_amount';

-- Show a sample of leads table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
ORDER BY ordinal_position
LIMIT 20;

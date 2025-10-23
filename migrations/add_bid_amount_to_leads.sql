-- Add bid_amount column to leads table to store historical bid amounts
-- This prevents retroactive bid changes from affecting historical revenue calculations

ALTER TABLE leads ADD COLUMN IF NOT EXISTS bid_amount DECIMAL(10,2) DEFAULT 0.00;

-- Add index for performance on revenue queries
CREATE INDEX IF NOT EXISTS idx_leads_bid_amount ON leads(bid_amount);

-- Add composite index for common revenue tracking queries
CREATE INDEX IF NOT EXISTS idx_leads_list_id_bid_amount ON leads(list_id, bid_amount);
CREATE INDEX IF NOT EXISTS idx_leads_created_at_bid_amount ON leads(created_at, bid_amount);

-- Add comment to document the purpose
COMMENT ON COLUMN leads.bid_amount IS 'Historical bid amount that was active when this lead was submitted - prevents retroactive changes';

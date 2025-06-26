-- Add policy_postback_date column to track when postbacks are received for revenue attribution
ALTER TABLE leads
ADD COLUMN policy_postback_date TIMESTAMPTZ;

-- Create index for efficient querying by postback date
CREATE INDEX IF NOT EXISTS idx_leads_policy_postback_date ON leads(policy_postback_date);

-- Create index for revenue queries filtering by policy_status and postback_date
CREATE INDEX IF NOT EXISTS idx_leads_policy_status_postback_date ON leads(policy_status, policy_postback_date);

-- Update existing leads with issued status to set postback_date = policy_updated_at if available
UPDATE leads 
SET policy_postback_date = policy_updated_at 
WHERE policy_status = 'issued' 
  AND policy_updated_at IS NOT NULL 
  AND policy_postback_date IS NULL;

-- For leads without policy_updated_at, use created_at as fallback (this maintains existing behavior)
UPDATE leads 
SET policy_postback_date = created_at 
WHERE policy_status = 'issued' 
  AND policy_postback_date IS NULL;

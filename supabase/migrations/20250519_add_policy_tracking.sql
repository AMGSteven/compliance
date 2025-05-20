-- Add policy status and related fields to the leads table
ALTER TABLE leads
ADD COLUMN policy_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN policy_id VARCHAR(100),
ADD COLUMN policy_carrier VARCHAR(100),
ADD COLUMN policy_type VARCHAR(100),
ADD COLUMN policy_premium DECIMAL(10,2),
ADD COLUMN policy_commission DECIMAL(10,2),
ADD COLUMN policy_effective_date DATE,
ADD COLUMN policy_notes TEXT,
ADD COLUMN policy_updated_at TIMESTAMPTZ;

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_leads_policy_status ON leads(policy_status);

-- Create a policy_postbacks table to track all postback events
CREATE TABLE IF NOT EXISTS policy_postbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id),
    policy_id VARCHAR(100),
    policy_status VARCHAR(50) NOT NULL,
    policy_carrier VARCHAR(100),
    policy_type VARCHAR(100),
    policy_premium DECIMAL(10,2),
    policy_commission DECIMAL(10,2),
    policy_effective_date DATE,
    policy_notes TEXT,
    transaction_id VARCHAR(100),
    raw_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Add RLS policies for policy_postbacks table
ALTER TABLE policy_postbacks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all policy postbacks
CREATE POLICY "Allow authenticated users to view all policy postbacks"
ON policy_postbacks FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert policy postbacks
CREATE POLICY "Allow authenticated users to insert policy postbacks"
ON policy_postbacks FOR INSERT
TO authenticated
WITH CHECK (true);

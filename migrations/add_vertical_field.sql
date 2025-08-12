-- Add vertical field to list_routings table
-- All current active list IDs default to ACA vertical

-- Add vertical column with default value
ALTER TABLE list_routings 
ADD COLUMN vertical VARCHAR(50) DEFAULT 'ACA';

-- Update all existing records to ACA (since all current campaigns are ACA)
UPDATE list_routings 
SET vertical = 'ACA' 
WHERE vertical IS NULL;

-- Create index for better performance on vertical queries
CREATE INDEX IF NOT EXISTS idx_list_routings_vertical ON list_routings(vertical);

-- Create vertical_configs table for managing dialer configurations per vertical
CREATE TABLE IF NOT EXISTS vertical_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vertical VARCHAR(50) NOT NULL,
    dialer_type INTEGER NOT NULL, -- 1=Internal, 2=Pitch BPO, 3=Convoso
    campaign_id VARCHAR(255),
    cadence_id VARCHAR(255),
    token VARCHAR(255), -- Only used for Pitch BPO (dialer_type = 2)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique combination of vertical + dialer_type
    UNIQUE(vertical, dialer_type)
);

-- Insert default configurations for ACA vertical
INSERT INTO vertical_configs (vertical, dialer_type, campaign_id, cadence_id, token) VALUES
-- ACA Internal Dialer (existing config)
('ACA', 1, 'b2c3d4e5-f6a1-4a1a-bde0-1a733c8d1c00', 'd669792b-2b43-4c8e-bb9d-d19e5420de63', NULL),
-- ACA Pitch BPO (existing config)  
('ACA', 2, 'pitch-bpo-campaign-aca', 'pitch-bpo-cadence-aca', '70942646-125b-4ddd-96fc-b9a142c698b8'),
-- ACA Convoso (existing config)
('ACA', 3, 'convoso-campaign-aca', 'convoso-cadence-aca', NULL)
ON CONFLICT (vertical, dialer_type) DO NOTHING;

-- Insert placeholder configurations for Final Expense vertical
INSERT INTO vertical_configs (vertical, dialer_type, campaign_id, cadence_id, token) VALUES
-- Final Expense Internal Dialer
('Final Expense', 1, 'fe-internal-campaign', 'fe-internal-cadence', NULL),
-- Final Expense Pitch BPO
('Final Expense', 2, 'fe-pitch-campaign', 'fe-pitch-cadence', '70942646-125b-4ddd-96fc-b9a142c698b8'),
-- Final Expense Convoso
('Final Expense', 3, 'fe-convoso-campaign', 'fe-convoso-cadence', NULL)
ON CONFLICT (vertical, dialer_type) DO NOTHING;

-- Insert placeholder configurations for Medicare vertical  
INSERT INTO vertical_configs (vertical, dialer_type, campaign_id, cadence_id, token) VALUES
-- Medicare Internal Dialer
('Medicare', 1, 'medicare-internal-campaign', 'medicare-internal-cadence', NULL),
-- Medicare Pitch BPO
('Medicare', 2, 'medicare-pitch-campaign', 'medicare-pitch-cadence', '70942646-125b-4ddd-96fc-b9a142c698b8'),
-- Medicare Convoso
('Medicare', 3, 'medicare-convoso-campaign', 'medicare-convoso-cadence', NULL)
ON CONFLICT (vertical, dialer_type) DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_vertical_configs_vertical ON vertical_configs(vertical);
CREATE INDEX IF NOT EXISTS idx_vertical_configs_dialer_type ON vertical_configs(dialer_type);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vertical_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vertical_configs_updated_at
    BEFORE UPDATE ON vertical_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_vertical_configs_updated_at();

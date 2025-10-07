-- Create vertical_state_configs table for managing allowed states per vertical
-- This allows different verticals to have different state restrictions

CREATE TABLE IF NOT EXISTS vertical_state_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vertical VARCHAR(50) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    is_allowed BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique combination of vertical + state_code
    UNIQUE(vertical, state_code)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vertical_state_configs_vertical ON vertical_state_configs(vertical);
CREATE INDEX IF NOT EXISTS idx_vertical_state_configs_state ON vertical_state_configs(state_code);
CREATE INDEX IF NOT EXISTS idx_vertical_state_configs_allowed ON vertical_state_configs(is_allowed);

-- Insert default state configurations for ACA vertical (current allowed states)
-- Based on current INTERNAL_DIALER_ALLOWED_STATES and PITCH_BPO_ALLOWED_STATES
INSERT INTO vertical_state_configs (vertical, state_code, is_allowed, notes) VALUES
-- ACA allowed states (union of Internal and Pitch BPO states)
('ACA', 'AL', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'AR', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'AZ', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'FL', true, 'Allowed for Pitch BPO only'),
('ACA', 'GA', true, 'Allowed for Internal Dialer'),
('ACA', 'IN', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'KS', true, 'Allowed for Pitch BPO'),
('ACA', 'KY', true, 'Allowed for Internal Dialer'),
('ACA', 'LA', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'ME', true, 'Allowed for Internal Dialer'),
('ACA', 'MI', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'MO', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'MS', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'NC', true, 'Allowed for Internal Dialer'),
('ACA', 'NM', true, 'Allowed for Internal Dialer'),
('ACA', 'OH', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'OK', true, 'Allowed for Pitch BPO'),
('ACA', 'PA', true, 'Allowed for Internal Dialer'),
('ACA', 'SC', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'TN', true, 'Allowed for both Internal and Pitch BPO'),
('ACA', 'TX', true, 'Allowed for Pitch BPO'),
('ACA', 'VA', true, 'Allowed for Internal Dialer'),
('ACA', 'WV', true, 'Allowed for Internal Dialer')
ON CONFLICT (vertical, state_code) DO NOTHING;

-- Insert default state configurations for Final Expense vertical
-- Start with same states as ACA, can be customized later
INSERT INTO vertical_state_configs (vertical, state_code, is_allowed, notes) VALUES
('Final Expense', 'AL', true, 'Default allowed'),
('Final Expense', 'AR', true, 'Default allowed'),
('Final Expense', 'AZ', true, 'Default allowed'),
('Final Expense', 'FL', true, 'Default allowed'),
('Final Expense', 'GA', true, 'Default allowed'),
('Final Expense', 'IN', true, 'Default allowed'),
('Final Expense', 'KS', true, 'Default allowed'),
('Final Expense', 'KY', true, 'Default allowed'),
('Final Expense', 'LA', true, 'Default allowed'),
('Final Expense', 'ME', true, 'Default allowed'),
('Final Expense', 'MI', true, 'Default allowed'),
('Final Expense', 'MO', true, 'Default allowed'),
('Final Expense', 'MS', true, 'Default allowed'),
('Final Expense', 'NC', true, 'Default allowed'),
('Final Expense', 'NM', true, 'Default allowed'),
('Final Expense', 'OH', true, 'Default allowed'),
('Final Expense', 'OK', true, 'Default allowed'),
('Final Expense', 'PA', true, 'Default allowed'),
('Final Expense', 'SC', true, 'Default allowed'),
('Final Expense', 'TN', true, 'Default allowed'),
('Final Expense', 'TX', true, 'Default allowed'),
('Final Expense', 'VA', true, 'Default allowed'),
('Final Expense', 'WV', true, 'Default allowed')
ON CONFLICT (vertical, state_code) DO NOTHING;

-- Insert default state configurations for Medicare vertical
INSERT INTO vertical_state_configs (vertical, state_code, is_allowed, notes) VALUES
('Medicare', 'AL', true, 'Default allowed'),
('Medicare', 'AR', true, 'Default allowed'),
('Medicare', 'AZ', true, 'Default allowed'),
('Medicare', 'FL', true, 'Default allowed'),
('Medicare', 'GA', true, 'Default allowed'),
('Medicare', 'IN', true, 'Default allowed'),
('Medicare', 'KS', true, 'Default allowed'),
('Medicare', 'KY', true, 'Default allowed'),
('Medicare', 'LA', true, 'Default allowed'),
('Medicare', 'ME', true, 'Default allowed'),
('Medicare', 'MI', true, 'Default allowed'),
('Medicare', 'MO', true, 'Default allowed'),
('Medicare', 'MS', true, 'Default allowed'),
('Medicare', 'NC', true, 'Default allowed'),
('Medicare', 'NM', true, 'Default allowed'),
('Medicare', 'OH', true, 'Default allowed'),
('Medicare', 'OK', true, 'Default allowed'),
('Medicare', 'PA', true, 'Default allowed'),
('Medicare', 'SC', true, 'Default allowed'),
('Medicare', 'TN', true, 'Default allowed'),
('Medicare', 'TX', true, 'Default allowed'),
('Medicare', 'VA', true, 'Default allowed'),
('Medicare', 'WV', true, 'Default allowed')
ON CONFLICT (vertical, state_code) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vertical_state_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vertical_state_configs_updated_at
    BEFORE UPDATE ON vertical_state_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_vertical_state_configs_updated_at();

-- Add comment to table
COMMENT ON TABLE vertical_state_configs IS 'Manages allowed states per vertical (ACA, Final Expense, Medicare). Each vertical can have different state restrictions.';

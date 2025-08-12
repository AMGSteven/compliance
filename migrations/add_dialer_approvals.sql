-- Migration: Add dialer approvals system
-- This creates a system to manage which dialers are approved for specific List IDs for compliance

-- Create dialer_approvals table
CREATE TABLE IF NOT EXISTS dialer_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id VARCHAR NOT NULL,
    dialer_type INTEGER NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT true,
    reason TEXT,
    approved_by VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one approval record per list_id + dialer_type combination
    UNIQUE(list_id, dialer_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dialer_approvals_list_id ON dialer_approvals(list_id);
CREATE INDEX IF NOT EXISTS idx_dialer_approvals_dialer_type ON dialer_approvals(dialer_type);
CREATE INDEX IF NOT EXISTS idx_dialer_approvals_approved ON dialer_approvals(approved);
CREATE INDEX IF NOT EXISTS idx_dialer_approvals_list_dialer ON dialer_approvals(list_id, dialer_type);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_dialer_approvals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dialer_approvals_updated_at
    BEFORE UPDATE ON dialer_approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_dialer_approvals_updated_at();

-- Insert default approvals for existing list_routings
-- All existing List IDs get approved for all dialer types by default (backward compatibility)
INSERT INTO dialer_approvals (list_id, dialer_type, approved, reason, approved_by)
SELECT DISTINCT 
    lr.list_id,
    dt.dialer_type,
    true as approved,
    'Default approval for existing List ID' as reason,
    'system-migration' as approved_by
FROM list_routings lr
CROSS JOIN (
    SELECT 1 as dialer_type UNION ALL  -- Internal Dialer
    SELECT 2 as dialer_type UNION ALL  -- Pitch BPO
    SELECT 3 as dialer_type            -- Convoso
) dt
WHERE lr.active = true
ON CONFLICT (list_id, dialer_type) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE dialer_approvals IS 'Manages which dialers are approved for specific List IDs for compliance purposes';
COMMENT ON COLUMN dialer_approvals.list_id IS 'The List ID that this approval applies to';
COMMENT ON COLUMN dialer_approvals.dialer_type IS 'The dialer type: 1=Internal Dialer, 2=Pitch BPO, 3=Convoso';
COMMENT ON COLUMN dialer_approvals.approved IS 'Whether this dialer is approved for this List ID';
COMMENT ON COLUMN dialer_approvals.reason IS 'Reason for approval/denial decision';
COMMENT ON COLUMN dialer_approvals.approved_by IS 'Who made the approval/denial decision';

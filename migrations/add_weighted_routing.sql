-- Add weighted routing support for percentage-based lead distribution
-- Allows splitting leads between multiple dialers (e.g., 70% Internal + 30% Pitch BPO)

-- Create routing_weights table for managing percentage splits per list ID
CREATE TABLE IF NOT EXISTS routing_weights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    list_id VARCHAR(255) NOT NULL,
    dialer_type INTEGER NOT NULL, -- 1=Internal, 2=Pitch BPO, 3=Convoso
    weight_percentage INTEGER NOT NULL CHECK (weight_percentage >= 0 AND weight_percentage <= 100),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique combination of list_id + dialer_type + active
    UNIQUE(list_id, dialer_type, active)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_routing_weights_list_id ON routing_weights(list_id);
CREATE INDEX IF NOT EXISTS idx_routing_weights_active ON routing_weights(active);
CREATE INDEX IF NOT EXISTS idx_routing_weights_list_dialer ON routing_weights(list_id, dialer_type);

-- Add constraint to ensure weights for a list_id sum to 100% (when active)
-- This will be enforced at the application level for flexibility

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_routing_weights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_routing_weights_updated_at
    BEFORE UPDATE ON routing_weights
    FOR EACH ROW
    EXECUTE FUNCTION update_routing_weights_updated_at();

-- Insert some sample weighted routing configurations
-- Example: Employers.io split 70% Internal, 30% Pitch BPO
INSERT INTO routing_weights (list_id, dialer_type, weight_percentage) VALUES
-- Example for a test list ID (replace with actual list ID)
('pitch-bpo-list-1752096715952', 1, 70), -- 70% Internal Dialer
('pitch-bpo-list-1752096715952', 2, 30)  -- 30% Pitch BPO
ON CONFLICT (list_id, dialer_type, active) DO NOTHING;

-- Add routing_weight_id to list_routings for tracking current active weight config
ALTER TABLE list_routings 
ADD COLUMN IF NOT EXISTS weighted_routing_enabled BOOLEAN DEFAULT false;

-- Add index for weighted routing filter
CREATE INDEX IF NOT EXISTS idx_list_routings_weighted ON list_routings(weighted_routing_enabled);

-- Create function to validate weight percentages sum to 100
CREATE OR REPLACE FUNCTION validate_routing_weights(p_list_id VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    total_weight INTEGER;
BEGIN
    SELECT COALESCE(SUM(weight_percentage), 0) 
    INTO total_weight 
    FROM routing_weights 
    WHERE list_id = p_list_id AND active = true;
    
    RETURN total_weight = 100;
END;
$$ language 'plpgsql';

-- Create function to get next dialer based on weighted distribution
CREATE OR REPLACE FUNCTION get_weighted_dialer(p_list_id VARCHAR(255), p_random_seed NUMERIC DEFAULT RANDOM())
RETURNS INTEGER AS $$
DECLARE
    weight_record RECORD;
    running_total INTEGER := 0;
    random_number INTEGER;
BEGIN
    -- Convert random seed (0-1) to percentage (1-100)
    random_number := FLOOR(p_random_seed * 100) + 1;
    
    -- Loop through weights in order and find which dialer the random number falls into
    FOR weight_record IN 
        SELECT dialer_type, weight_percentage 
        FROM routing_weights 
        WHERE list_id = p_list_id AND active = true 
        ORDER BY dialer_type ASC
    LOOP
        running_total := running_total + weight_record.weight_percentage;
        IF random_number <= running_total THEN
            RETURN weight_record.dialer_type;
        END IF;
    END LOOP;
    
    -- Fallback: return first available dialer if something goes wrong
    SELECT dialer_type INTO weight_record.dialer_type
    FROM routing_weights 
    WHERE list_id = p_list_id AND active = true 
    ORDER BY dialer_type ASC 
    LIMIT 1;
    
    RETURN COALESCE(weight_record.dialer_type, 1); -- Default to Internal Dialer
END;
$$ language 'plpgsql';

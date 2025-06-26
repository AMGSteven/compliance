-- Create table for storing Bland AI call costs
CREATE TABLE bland_ai_call_costs (
  id BIGSERIAL PRIMARY KEY,
  call_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  cost DECIMAL(10,4) NOT NULL DEFAULT 0,
  price DECIMAL(10,4) DEFAULT 0,
  duration_seconds INTEGER,
  status VARCHAR(50),
  from_number VARCHAR(20),
  to_number VARCHAR(20),
  webhook_data JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_date DATE GENERATED ALWAYS AS (DATE(created_at AT TIME ZONE 'America/New_York')) STORED
);

-- Create indexes for efficient querying
CREATE INDEX idx_bland_ai_costs_date ON bland_ai_call_costs(created_date);
CREATE INDEX idx_bland_ai_costs_created_at ON bland_ai_call_costs(created_at);
CREATE INDEX idx_bland_ai_costs_call_id ON bland_ai_call_costs(call_id);
CREATE INDEX idx_bland_ai_costs_processed_at ON bland_ai_call_costs(processed_at);

-- Create a view for daily cost summaries (super fast queries)
CREATE VIEW daily_bland_ai_costs AS
SELECT 
  created_date,
  COUNT(*) as total_calls,
  SUM(cost) as total_cost,
  AVG(cost) as avg_cost_per_call,
  MIN(cost) as min_cost,
  MAX(cost) as max_cost,
  SUM(duration_seconds) as total_duration_seconds
FROM bland_ai_call_costs
GROUP BY created_date
ORDER BY created_date DESC;

-- Add Row Level Security (RLS) for data protection
ALTER TABLE bland_ai_call_costs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage all data
CREATE POLICY "Service role can manage all data" ON bland_ai_call_costs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create policy for authenticated users to read data
CREATE POLICY "Authenticated users can read data" ON bland_ai_call_costs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON TABLE bland_ai_call_costs IS 'Stores daily call cost data from Bland AI API for efficient dashboard queries';
COMMENT ON COLUMN bland_ai_call_costs.created_date IS 'Auto-generated date in EST timezone for efficient daily aggregations';
COMMENT ON VIEW daily_bland_ai_costs IS 'Pre-aggregated daily cost summaries for dashboard performance';

-- Setup daily revenue report cron job
-- Runs at 6PM ET every weekday and calls the Supabase Edge Function

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing daily revenue report cron jobs
SELECT cron.unschedule('daily-revenue-report');

-- Schedule the daily revenue report to run at 6PM ET (America/New_York timezone)
-- This handles EST/EDT automatically
-- Runs Monday through Friday (1-5)
SELECT cron.schedule(
  'daily-revenue-report',
  '0 18 * * 1-5',  -- 6:00 PM every weekday
  'SELECT net.http_post(
    url := ''https://znkqdfnzhtdoktkuczjr.supabase.co/functions/v1/daily-revenue-report'',
    headers := ''{"Content-Type": "application/json", "Authorization": "Bearer " || current_setting(''app.supabase_service_role_key'', true)}'',
    body := ''{"trigger": "cron", "timezone": "America/New_York"}''
  );'
);

-- Set the timezone for the cron job to Eastern Time
UPDATE cron.job 
SET timezone = 'America/New_York' 
WHERE jobname = 'daily-revenue-report';

-- Create a log table for monitoring cron job executions
CREATE TABLE IF NOT EXISTS daily_report_cron_logs (
  id bigserial PRIMARY KEY,
  executed_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  response_data jsonb,
  error_message text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_report_cron_logs_executed_at ON daily_report_cron_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_daily_report_cron_logs_status ON daily_report_cron_logs(status);

-- Create a function to test the daily revenue report manually
CREATE OR REPLACE FUNCTION trigger_daily_revenue_report_manual()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_data jsonb;
  start_time timestamp;
  end_time timestamp;
  execution_time integer;
BEGIN
  start_time := clock_timestamp();
  
  -- Log the start
  INSERT INTO daily_report_cron_logs (status, response_data)
  VALUES ('running', '{"trigger": "manual", "started_at": "' || start_time::text || '"}')
  RETURNING id INTO response_data;
  
  -- Call the edge function
  SELECT net.http_post(
    url := 'https://znkqdfnzhtdoktkuczjr.supabase.co/functions/v1/daily-revenue-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key', true) || '"}',
    body := '{"trigger": "manual_test", "timezone": "America/New_York"}'
  ) INTO response_data;
  
  end_time := clock_timestamp();
  execution_time := EXTRACT(milliseconds FROM (end_time - start_time))::integer;
  
  -- Update the log with results
  UPDATE daily_report_cron_logs 
  SET 
    status = CASE 
      WHEN (response_data->>'status_code')::integer < 400 THEN 'success' 
      ELSE 'error' 
    END,
    response_data = response_data,
    execution_time_ms = execution_time
  WHERE id = (response_data->>'id')::bigint;
  
  RETURN jsonb_build_object(
    'success', true,
    'execution_time_ms', execution_time,
    'response_status', response_data->>'status_code',
    'message', 'Daily revenue report triggered manually'
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  INSERT INTO daily_report_cron_logs (status, error_message, execution_time_ms)
  VALUES ('error', SQLERRM, EXTRACT(milliseconds FROM (clock_timestamp() - start_time))::integer);
  
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Failed to trigger daily revenue report'
  );
END;
$$;

-- Grant necessary permissions for the cron job
-- Note: In production, ensure proper security settings

COMMENT ON FUNCTION trigger_daily_revenue_report_manual() IS 'Manually trigger the daily revenue report edge function for testing';
COMMENT ON TABLE daily_report_cron_logs IS 'Logs for daily revenue report cron job executions';

-- Show the scheduled cron job
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job 
WHERE jobname = 'daily-revenue-report'; 
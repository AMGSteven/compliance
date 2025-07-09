-- Create function to count leads by list_id
CREATE OR REPLACE FUNCTION get_lead_counts_by_list_id()
RETURNS TABLE(list_id TEXT, lead_count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    leads.list_id::TEXT as list_id,
    COUNT(*)::BIGINT as lead_count
  FROM leads 
  WHERE leads.list_id IS NOT NULL
  GROUP BY leads.list_id
  ORDER BY COUNT(*) DESC;
$$;

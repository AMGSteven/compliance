-- SQL function to count leads by list_id
CREATE OR REPLACE FUNCTION count_leads_by_list_id()
RETURNS TABLE(list_id TEXT, count BIGINT)
LANGUAGE SQL
AS $$
  SELECT 
    leads.list_id::TEXT,
    COUNT(*)::BIGINT
  FROM leads 
  WHERE leads.list_id IS NOT NULL
  GROUP BY leads.list_id
  ORDER BY COUNT(*) DESC;
$$;

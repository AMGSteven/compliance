-- SQL function to update a percentage of leads to 'success' status
CREATE OR REPLACE FUNCTION update_random_leads_to_success(success_percentage float)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count int;
BEGIN
  -- Update random subset of leads to 'success' status
  WITH leads_to_update AS (
    SELECT id
    FROM leads
    WHERE status != 'success'
    ORDER BY random()
    LIMIT (SELECT COUNT(*) * success_percentage / 100 FROM leads WHERE status != 'success')
  )
  UPDATE leads
  SET status = 'success'
  FROM leads_to_update
  WHERE leads.id = leads_to_update.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  RETURN updated_count;
END;
$$;

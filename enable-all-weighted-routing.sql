-- Enable weighted routing for all list IDs that have weights configured
-- This will activate the 50/50 routing for all Medicare campaigns

-- Enable weighted routing for all list IDs with configured weights
UPDATE list_routings 
SET weighted_routing_enabled = true 
WHERE list_id IN (
  SELECT DISTINCT list_id 
  FROM routing_weights 
  WHERE active = true
  GROUP BY list_id 
  HAVING COUNT(*) > 1  -- Only lists with multiple dialers (actual weighted routing)
);

-- Verify which lists now have weighted routing enabled
SELECT 
  lr.list_id,
  lr.description,
  lr.weighted_routing_enabled,
  COUNT(rw.id) as weight_count,
  STRING_AGG(CONCAT('Dialer ', rw.dialer_type, ': ', rw.weight_percentage, '%'), ', ' ORDER BY rw.dialer_type) as weights
FROM list_routings lr
LEFT JOIN routing_weights rw ON lr.list_id = rw.list_id AND rw.active = true
WHERE lr.weighted_routing_enabled = true
GROUP BY lr.list_id, lr.description, lr.weighted_routing_enabled
ORDER BY lr.description;

-- Show summary
SELECT 
  'Total list IDs with weighted routing enabled:' as summary,
  COUNT(*) as count
FROM list_routings 
WHERE weighted_routing_enabled = true;

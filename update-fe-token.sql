-- Update Final Expense token in list_routings table
-- Change from ACA token to Final Expense token for pitch-bpo-list-1755720801791

UPDATE list_routings 
SET 
    token = '9f62ddd5-384c-42bd-b862-0cdce7b00a73',  -- Final Expense token
    updated_at = NOW()
WHERE 
    list_id = 'pitch-bpo-list-1755720801791' 
    AND token = '70942646-125b-4ddd-96fc-b9a142c698b8';  -- Only update if it currently has ACA token

-- Verify the update
SELECT 
    list_id,
    token,
    vertical,
    campaign_id,
    cadence_id,
    updated_at
FROM list_routings 
WHERE list_id = 'pitch-bpo-list-1755720801791';

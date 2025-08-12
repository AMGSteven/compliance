-- Fix routing issues for ALL provided List IDs
-- This will solve both the dialer routing and duplicate rejection problems

-- FIRST: Ensure all existing routings are ACTIVE (common cause of "null" routing results)
UPDATE list_routings SET active = true, updated_at = NOW() 
WHERE list_id IN (
    'pitch-bpo-list-1750372488308',
    'pitch-bpo-list-1750372500892',
    'f2a566d2-0e97-4a7d-bc95-389dade78caf',
    '9cfc34d0-1236-4258-b4cd-9947baf28467'
) AND active = false;

-- 1. Fix Pitch BPO routing for pitch-bpo-list-1750372500892 (the problematic one)
INSERT INTO list_routings (
    list_id, 
    campaign_id, 
    cadence_id, 
    description, 
    active, 
    bid, 
    token, 
    dialer_type,
    auto_claim_trusted_form,
    created_at, 
    updated_at
) VALUES (
    'pitch-bpo-list-1750372500892',
    'pitch-bpo-campaign-1752096715952', -- Using the newer campaign ID you provided
    'pitch-bpo-cadence-1750372500892',
    'Pitch BPO Routing (FIXED - Was Defaulting to Internal)',
    true,
    0.30,
    '70942646-125b-4ddd-96fc-b9a142c698b8',
    2, -- DIALER_TYPE_PITCH_BPO (critical!)
    false,
    NOW(),
    NOW()
) ON CONFLICT (list_id) DO UPDATE SET
    dialer_type = 2, -- Force Pitch BPO
    active = true,
    campaign_id = 'pitch-bpo-campaign-1752096715952',
    cadence_id = 'pitch-bpo-cadence-1750372500892',
    token = '70942646-125b-4ddd-96fc-b9a142c698b8',
    bid = 0.30,
    description = 'Pitch BPO Routing (FIXED - Was Defaulting to Internal)',
    updated_at = NOW();

-- 2. Fix the other Pitch BPO list too
INSERT INTO list_routings (
    list_id, 
    campaign_id, 
    cadence_id, 
    description, 
    active, 
    bid, 
    token, 
    dialer_type,
    auto_claim_trusted_form,
    created_at, 
    updated_at
) VALUES (
    'pitch-bpo-list-1750372488308',
    'pitch-bpo-campaign-1752096702231', -- Using the other campaign ID you provided
    'pitch-bpo-cadence-1750372488308',
    'Pitch BPO Routing (Additional)',
    true,
    0.30,
    '70942646-125b-4ddd-96fc-b9a142c698b8',
    2, -- DIALER_TYPE_PITCH_BPO
    false,
    NOW(),
    NOW()
) ON CONFLICT (list_id) DO UPDATE SET
    dialer_type = 2,
    active = true,
    campaign_id = 'pitch-bpo-campaign-1752096702231',
    token = '70942646-125b-4ddd-96fc-b9a142c698b8',
    bid = 0.30,
    updated_at = NOW();

-- 3. Fix Employers.io Regular routing (duplicate issue fix)
INSERT INTO list_routings (
    list_id, 
    campaign_id, 
    cadence_id, 
    description, 
    active, 
    bid, 
    token, 
    dialer_type,
    auto_claim_trusted_form,
    created_at, 
    updated_at
) VALUES (
    'f2a566d2-0e97-4a7d-bc95-389dade78caf',
    'b2c3d4e5-f6a1-4a1a-bde0-1a733c8d1c00',
    'd669792b-2b43-4c8e-bb9d-d19e5420de63',
    'Employers.io Regular Hours (FIXED - Was Rejecting All)',
    true,
    0.45,
    '2b31ac9d38f10a4d0c3b1d4293767cd6',
    1, -- DIALER_TYPE_INTERNAL
    false,
    NOW(),
    NOW()
) ON CONFLICT (list_id) DO UPDATE SET
    active = true,
    bid = 0.45,
    token = '2b31ac9d38f10a4d0c3b1d4293767cd6',
    dialer_type = 1,
    description = 'Employers.io Regular Hours (FIXED - Was Rejecting All)',
    updated_at = NOW();

-- 4. Fix Employers.io After Hours routing (duplicate issue fix)
INSERT INTO list_routings (
    list_id, 
    campaign_id, 
    cadence_id, 
    description, 
    active, 
    bid, 
    token, 
    dialer_type,
    auto_claim_trusted_form,
    created_at, 
    updated_at
) VALUES (
    '9cfc34d0-1236-4258-b4cd-9947baf28467',
    'b2c3d4e5-f6a1-4a1a-bde0-1a733c8d1c00',
    'd669792b-2b43-4c8e-bb9d-d19e5420de63',
    'Employers.io After Hours (FIXED - Was Rejecting All)',
    true,
    0.25,
    '49a1c758cd894a0c1fe1017c42bef05f',
    1, -- DIALER_TYPE_INTERNAL
    false,
    NOW(),
    NOW()
) ON CONFLICT (list_id) DO UPDATE SET
    active = true,
    bid = 0.25,
    token = '49a1c758cd894a0c1fe1017c42bef05f',
    dialer_type = 1,
    description = 'Employers.io After Hours (FIXED - Was Rejecting All)',
    updated_at = NOW();

-- Verify the insertions
SELECT 
    list_id, 
    description, 
    dialer_type,
    active,
    bid,
    campaign_id,
    cadence_id,
    token
FROM list_routings 
WHERE list_id IN (
    'pitch-bpo-list-1750372500892',
    'f2a566d2-0e97-4a7d-bc95-389dade78caf', 
    '9cfc34d0-1236-4258-b4cd-9947baf28467'
)
ORDER BY list_id;

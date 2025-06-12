#!/bin/bash
# Test script to send a lead to Pitch BPO dialer using curl

# Define payload for better readability
PAYLOAD='{
    "first_name": "TestFirstName",
    "last_name": "TestLastName",
    "email": "test@example.com",
    "phone": "9177956332",
    "state": "TX",
    "city": "San Francisco",
    "zip": "94107",
    "traffic_source": "compliance_test",
    "ip_address": "127.0.0.1",
    "landing_page": "https://test.compliance.com",
    "tc_agreed": true,
    "custom1": "TestCustom1",
    "list_id": "pitch-bpo-list-1749233817305",
    "campaign_id": "pitch-bpo-campaign-1749233817305",
    "cadence_id": "pitch-bpo-cadence-1749233817305",
    "income_bracket": "100000-150000",
    "homeowner_status": "Yes",
    "age_range": "35-44",
    "dialer_type": 2,
    "test_mode": false
}'

echo "============================================================="
echo "=== SENDING TEST LEAD TO PITCH BPO WITH PHONE 9177956332 ==="
echo "============================================================="
echo ""
echo "REQUEST PAYLOAD:"
echo "$PAYLOAD" | jq '.' 2>/dev/null || echo "$PAYLOAD"
echo ""
echo "SENDING REQUEST TO http://localhost:3000/api/leads..."
echo ""

# Send request and store the response
RESPONSE=$(curl -s -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: test_key_123" \
  -d "$PAYLOAD")

echo "RESPONSE FROM SERVER:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Check if the response contains dialer forwarding info
if echo "$RESPONSE" | grep -q '"forwarded":true'; then
  echo ""
  echo "✅ SUCCESS: Lead was successfully forwarded to Pitch BPO dialer!"
  
  # Extract the Pitch BPO payload that was sent to their API
  if echo "$RESPONSE" | grep -q 'Sending lead to Pitch BPO'; then
    PITCH_PAYLOAD=$(echo "$RESPONSE" | grep -o '{"uuid":"[^}]*}' | head -1)
    echo ""
    echo "ACTUAL PAYLOAD SENT TO PITCH BPO API:"
    echo "$PITCH_PAYLOAD" | jq '.' 2>/dev/null || echo "$PITCH_PAYLOAD"
  fi
else
  echo ""
  echo "❌ FAILURE: Lead was not forwarded to Pitch BPO dialer."
  echo "Check server logs for details."
fi

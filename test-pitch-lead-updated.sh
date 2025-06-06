#!/bin/bash

# Test sending a lead through the local API to Pitch BPO
# Now using the updated API endpoint that matches the documentation

# API endpoint
API_ENDPOINT="http://localhost:3000/api/leads"

# API key header for local testing
API_KEY="test_key_123"

# Test lead data with proper format matching the API expectations
PAYLOAD='{
    "first_name": "TestFirstName",
    "last_name": "TestLastName",
    "email": "test@example.com",
    "phone": "9259985103",
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

echo "==================================="
echo "PAYLOAD:"
echo "$PAYLOAD" | jq .
echo "==================================="
echo "Sending request to $API_ENDPOINT..."

# Send the request and capture the response
RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "$PAYLOAD" \
  "$API_ENDPOINT")

echo "==================================="
echo "RESPONSE:"
echo "$RESPONSE" | jq .

# Check if the response indicates a successful Pitch BPO dialer forwarding
if echo "$RESPONSE" | grep -q "pitch_bpo"; then
  echo "==================================="
  echo "✅ Lead was successfully processed through the Pitch BPO dialer pathway"
  
  # Extract and display the forwarded URL from the logs if possible
  FORWARDED_URL=$(echo "$RESPONSE" | grep -o "https://api.chasedatacorp.com/HttpImport/InjectLead.php[^\"']*")
  if [ ! -z "$FORWARDED_URL" ]; then
    echo "Forwarded to: $FORWARDED_URL"
  fi
else
  echo "==================================="
  echo "❌ Lead was NOT processed through the Pitch BPO dialer pathway"
  echo "Check server logs for more details"
fi

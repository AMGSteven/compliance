#!/bin/bash

# Direct test to Pitch BPO API
echo "Attempting direct API call to Pitch BPO API..."

# Define the payload
PAYLOAD='{
  "uuid": "70942646-125b-4ddd-96fc-b9a142c698b8",
  "campaign": "Jade ACA",
  "subcampaign": "Juiced Real Time",
  "first_name": "TestFirstName",
  "last_name": "TestLastName",
  "phone": "9177956332",
  "email": "test@example.com",
  "state": "TX",
  "compliance_lead_id": "direct-test-lead-123",
  "source": "Compliance Engine Direct Test"
}'

echo "==================================="
echo "PAYLOAD:"
echo "$PAYLOAD" | jq .
echo "==================================="

# Attempt the direct API call
echo "Sending request to https://api.chasedatacorp.com/api/leads..."

curl -v -X POST \
  https://api.chasedatacorp.com/api/leads \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo ""
echo "==================================="
echo "Curl complete. Check output above for response details."

#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Base URL for the API
BASE_URL="http://localhost:3003/api"

# API Key for authentication
API_KEY="test_key_123"

echo -e "${BLUE}=== Testing Synergy DNC Integration ===${NC}"
echo

# Test 1: DNC number (should fail compliance)
DNC_NUMBER="9317167522"
echo -e "${BLUE}Test 1: Checking DNC number: ${DNC_NUMBER} (should be rejected)${NC}"
DNC_RESPONSE=$(curl -s -X POST "${BASE_URL}/check-compliance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{\"phone\":\"${DNC_NUMBER}\"}")

echo "Response: $DNC_RESPONSE"
if echo "$DNC_RESPONSE" | grep -q "Synergy DNC"; then
  echo -e "${GREEN}✓ Success: DNC number correctly identified by Synergy DNC check${NC}"
else
  echo -e "${RED}✗ Failed: DNC number not identified by Synergy DNC check${NC}"
fi
echo

# Test 2: Non-DNC number (should pass compliance)
CLEAN_NUMBER="6507769592"
echo -e "${BLUE}Test 2: Checking non-DNC number: ${CLEAN_NUMBER} (should pass)${NC}"
CLEAN_RESPONSE=$(curl -s -X POST "${BASE_URL}/check-compliance" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "{\"phone\":\"${CLEAN_NUMBER}\"}")

echo "Response: $CLEAN_RESPONSE"
if ! echo "$CLEAN_RESPONSE" | grep -q "Synergy DNC"; then
  echo -e "${GREEN}✓ Success: Clean number correctly passed Synergy DNC check${NC}"
else
  echo -e "${RED}✗ Failed: Clean number incorrectly flagged by Synergy DNC check${NC}"
fi
echo

# Test 3: Submit lead with DNC number (should be rejected with $0 bid)
echo -e "${BLUE}Test 3: Submitting lead with DNC number: ${DNC_NUMBER} (should be rejected with \$0 bid)${NC}"
DNC_LEAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/leads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "'${DNC_NUMBER}'",
    "state": "CA",
    "zipCode": "90210",
    "listId": "test-list",
    "campaignId": "test-campaign",
    "incomeBracket": "50000-75000",
    "homeownerStatus": "owner",
    "ageRange": "30-40"
  }')

echo "Response: $DNC_LEAD_RESPONSE"
if echo "$DNC_LEAD_RESPONSE" | grep -q '"bid":0'; then
  echo -e "${GREEN}✓ Success: Lead with DNC number correctly rejected with \$0 bid${NC}"
else
  echo -e "${RED}✗ Failed: Lead with DNC number not rejected with \$0 bid${NC}"
fi
echo

# Test 4: Submit lead with clean number (should be accepted)
echo -e "${BLUE}Test 4: Submitting lead with clean number: ${CLEAN_NUMBER} (should be accepted)${NC}"
CLEAN_LEAD_RESPONSE=$(curl -s -X POST "${BASE_URL}/leads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@example.com",
    "phone": "'${CLEAN_NUMBER}'",
    "state": "CA",
    "zipCode": "90210",
    "listId": "test-list",
    "campaignId": "test-campaign",
    "incomeBracket": "50000-75000",
    "homeownerStatus": "owner",
    "ageRange": "30-40"
  }')

echo "Response: $CLEAN_LEAD_RESPONSE"
if echo "$CLEAN_LEAD_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Success: Lead with clean number correctly accepted${NC}"
else
  echo -e "${RED}✗ Failed: Lead with clean number not accepted${NC}"
fi
echo

echo -e "${BLUE}=== End-to-End Test Complete ===${NC}"

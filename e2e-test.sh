#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Base URL for the API
BASE_URL="http://localhost:3003/api"

# API Key for authentication
API_KEY="test_key_123"

# Test phone numbers
DNC_NUMBER="9317167522"      # Should be on Synergy DNC
CLEAN_NUMBER="6507769592"    # Should not be on Synergy DNC

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}   SYNERGY DNC INTEGRATION E2E TEST     ${NC}"
echo -e "${BLUE}=========================================${NC}"
echo

# ====================================
# Test 1: Submit lead with DNC number
# ====================================
echo -e "${YELLOW}TEST 1: Submit lead with DNC number: ${DNC_NUMBER} (should be rejected with \$0 bid)${NC}"

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
    "listId": "1b759535-2a5e-421e-9371-3bde7f855c60",
    "campaignId": "test-campaign",
    "incomeBracket": "50000-75000",
    "homeownerStatus": "owner",
    "ageRange": "30-40"
  }')

echo -e "${BLUE}Response:${NC}"
echo "$DNC_LEAD_RESPONSE" | jq || echo "$DNC_LEAD_RESPONSE"

# Check if the response contains success=false and bid=0
if echo "$DNC_LEAD_RESPONSE" | grep -q '"success":false' && echo "$DNC_LEAD_RESPONSE" | grep -q '"bid":0'; then
  echo -e "${GREEN}✓ SUCCESS: Lead with DNC number correctly rejected with \$0 bid${NC}"
elif echo "$DNC_LEAD_RESPONSE" | grep -q '"bid":0'; then
  echo -e "${YELLOW}⚠ PARTIAL SUCCESS: Lead with DNC number has \$0 bid but wasn't rejected${NC}"
else
  echo -e "${RED}✗ FAILED: Lead with DNC number was not properly handled${NC}"
fi
echo

# ====================================
# Test 2: Submit lead with clean number
# ====================================
echo -e "${YELLOW}TEST 2: Submit lead with clean number: ${CLEAN_NUMBER} (should be accepted)${NC}"

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
    "listId": "1b759535-2a5e-421e-9371-3bde7f855c60",
    "campaignId": "test-campaign",
    "incomeBracket": "50000-75000",
    "homeownerStatus": "owner",
    "ageRange": "30-40"
  }')

echo -e "${BLUE}Response:${NC}"
echo "$CLEAN_LEAD_RESPONSE" | jq || echo "$CLEAN_LEAD_RESPONSE"

# Check if the response indicates success
if echo "$CLEAN_LEAD_RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ SUCCESS: Lead with clean number correctly accepted${NC}"
else
  echo -e "${RED}✗ FAILED: Lead with clean number was not properly accepted${NC}"
fi
echo

# ====================================
# Verify server logs for compliance checks
# ====================================
echo -e "${YELLOW}NOTE: Check server console logs to verify:${NC}"
echo -e "  1. Synergy DNC checker is being called as part of the compliance pipeline"
echo -e "  2. The DNC number (${DNC_NUMBER}) is identified as non-compliant"
echo -e "  3. The clean number (${CLEAN_NUMBER}) is identified as compliant"
echo

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}     END-TO-END TEST COMPLETE           ${NC}"
echo -e "${BLUE}=========================================${NC}"

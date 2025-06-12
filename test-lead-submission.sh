#!/bin/bash

# Test lead submission script
echo "Submitting test lead to check compliance functionality..."

# Use a regular phone number (not the test bypass numbers)
# This should trigger full compliance checks including TCPA
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com", 
    "phone": "5551234567",
    "zipCode": "90210",
    "state": "TX",
    "listId": "regular-test-list",
    "source": "compliance-test",
    "bidValue": 5.00
  }'

echo -e "\n\nSubmitting test with known test phone number (should bypass checks)..."
# This should bypass compliance checks
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "Bypass",
    "email": "bypass@example.com", 
    "phone": "6507769592",
    "zipCode": "90210",
    "state": "TX",
    "listId": "test-bypass-list",
    "source": "compliance-test",
    "bidValue": 5.00
  }'

echo -e "\n\nDone with test submissions"

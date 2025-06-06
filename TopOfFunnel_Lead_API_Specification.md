# Lead Submission API Specification for Top of Funnel LLC

## Overview
This document outlines the specifications for submitting leads to our compliance system via the API. All leads undergo comprehensive compliance checks including TCPA verification, blacklist checking, phone validation, and duplicate detection before acceptance.

## API Endpoint
```
POST https://compliance.juicedmedia.io/api/leads
```

## Authentication
Include your API key in the request:
```
token: be53740f04b40724b950c95d71e2528d
```

## Required Fields
The following fields are required for all lead submissions:

| Field | Description | Example |
|-------|-------------|---------|
| firstName | First name of the lead | "John" |
| lastName | Last name of the lead | "Doe" |
| email | Valid email address | "johndoe@example.com" |
| phone | Phone number (10 digits) | "6507769592" |
| zipCode | 5-digit ZIP code | "94025" |
| trustedFormCertUrl | TrustedForm certificate URL | "https://cert.trustedform.com/..." |
| listId | Your assigned list ID | "94ec4eec-d409-422b-abbd-bd9ee35ce08a" |
| campaignId | Your assigned campaign ID | "your_assigned_campaign_id" |
| incomeBracket | Income range of the lead | "$50,000-$75,000" |
| state | Two-letter state code | "TX" |
| homeownerStatus | Housing status | "Homeowner" or "Renter" |
| ageRange or dob | Age range or full DOB | "35-44" or "1985-06-15" |

## State Restrictions
**IMPORTANT**: Leads are only accepted from the following states:
- AL, AR, AZ, IN, KS, LA, MO, MS, OH, SC, TN, TX

Any leads submitted with states other than these will be automatically rejected.

## Optional Fields
These fields are recommended but not required:

| Field | Description | Example |
|-------|-------------|---------|
| address | Street address | "123 Main St" |
| city | City name | "Menlo Park" |
| cadenceId | Optional cadence ID | "your_cadence_id" |
| source | Lead source information | "Top of Funnel LLC" |
| customFields | Any additional data as JSON object | `{"utm_source": "facebook"}` |

## Field-Name Flexibility
Choose one naming convention and use it consistently:
- camelCase: `firstName`, `lastName`
- snake_case: `first_name`, `last_name`
- PascalCase: `FirstName`, `LastName`

## Compliance Workflow
1. Receive lead → instant background checks
2. Fail any check → lead rejected (success:false, bid:0.00)
3. Pass all checks → lead accepted and bid returned (success:true, bid:>0)

Typical response time: < 2 seconds.

## Compliance Checks
All submitted leads undergo:
1. TCPA and DNC registry compliance checks
2. Phone validation to ensure active, non-VoIP numbers
3. Duplicate detection (30-day lookback period)
4. Blacklist verification
5. State eligibility verification (only accepts AL, AR, AZ, IN, KS, LA, MO, MS, OH, SC, TN, TX)

## Response Format
### Successful Submission
```json
{
  "success": true,
  "lead_id": "abc123def456",
  "data": {
    "id": "abc123def456",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "6507769592",
    "email": "johndoe@example.com",
    "created_at": "2025-05-29T15:26:37-07:00"
  },
  "bid": 0.35
}
```

### Failed Submission
```json
{
  "success": false,
  "bid": 0.00,
  "error": "Phone number failed compliance check with: TCPA, Phone Validation",
  "details": {
    "failedSources": ["TCPA", "Phone Validation"],
    "reasons": [
      "Number on Do Not Call registry",
      "Disconnected number"
    ],
    "phoneNumber": "6507769592"
  }
}
```

## Test Example
Here's a sample request that should pass validation:

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "johndoe@example.com",
  "phone": "6507769592",
  "address": "123 Main St",
  "city": "Houston",
  "state": "TX",
  "zipCode": "77001",
  "listId": "94ec4eec-d409-422b-abbd-bd9ee35ce08a",
  "campaignId": "your_assigned_campaign_id",
  "incomeBracket": "$75,000-$100,000",
  "homeownerStatus": "Homeowner",
  "dob": "1980-05-15",
  "source": "Top of Funnel LLC",
  "trustedFormCertUrl": "https://cert.trustedform.com/example",
  "token": "be53740f04b40724b950c95d71e2528d"
}
```

## Integration Checklist
1. Start with test phone in a valid state (e.g., TX, OH, MS)
2. Submit 5–10 sample leads; verify success & failure handling
3. Handle non-200 HTTP codes and success:false bodies gracefully
4. Log Juiced Media lead_id for reconciliation

## Key Rules & Tips
- Phone format: 10 digits, no punctuation
- success: false ⇒ lead failed compliance (do not post it downstream)
- TrustedForm certificate is mandatory for TCPA coverage
- Keep latency SLAs in mind (≤ 2 s typical)
- Only submit leads from approved states (AL, AR, AZ, IN, KS, LA, MO, MS, OH, SC, TN, TX)

## Support
For integration support, please contact:
- Technical Support: support@juicedmedia.io
- Hours: Monday-Friday, 9am-5pm PT

## Revision History
- Version 1.1 (May 29, 2025): Added state restrictions
- Version 1.0 (May 29, 2025): Initial specification

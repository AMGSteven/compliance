# Policy Postback System

This documentation explains how to set up and use the policy postback system for tracking policy status updates from external partners.

## Database Schema

The policy tracking system adds the following fields to the `leads` table:

- `policy_status`: Current status of the policy (pending, issued, paid, cancelled, rejected)
- `policy_id`: Unique identifier for the policy
- `policy_carrier`: Insurance carrier name
- `policy_type`: Type of policy (health, auto, life, etc.)
- `policy_premium`: Policy premium amount
- `policy_commission`: Commission earned from this policy
- `policy_effective_date`: Date when the policy becomes effective
- `policy_notes`: Additional notes about the policy
- `policy_updated_at`: Timestamp of the last policy status update

It also creates a new `policy_postbacks` table to track all policy status updates.

## Environment Setup

Add the following to your `.env.local` file:

```
# Policy Postback API Key
POLICY_POSTBACK_API_KEY=your-secure-api-key-here
```

## Running the Migration

To apply the database changes, run the migration:

```bash
# Navigate to your project directory
cd /Users/shaanpatel/CascadeProjects/compliance

# If using Supabase CLI
supabase db diff -f add_policy_tracking
supabase migration up

# Or manually run the SQL on your Supabase instance
# 1. Go to the Supabase dashboard
# 2. Navigate to the SQL Editor
# 3. Copy and paste the contents of supabase/migrations/20250519_add_policy_tracking.sql
# 4. Run the query
```

## API Usage

The policy postback API allows external partners to update policy status for leads in your system.

### Endpoint

```
POST /api/policy-postback
```

### Authentication

Include the API key in your request body:

```json
{
  "api_key": "your-secure-api-key-here",
  ...
}
```

### Lead Identification

The API can identify leads by any of the following fields (in order of preference):

1. `lead_id`: Supabase UUID of the lead
2. `transaction_id`: The original transaction ID
3. `email`: Email address of the lead
4. `phone`: Phone number of the lead

### Request Body Example

```json
{
  "api_key": "your-secure-api-key-here",
  "transaction_id": "TRANS123456",
  "policy_id": "POL-987654",
  "policy_status": "issued",
  "policy_carrier": "Blue Cross Blue Shield",
  "policy_type": "Health Insurance",
  "policy_premium": 349.99,
  "policy_commission": 87.50,
  "policy_effective_date": "2025-06-01",
  "policy_notes": "Family plan with dental coverage"
}
```

### Policy Statuses

Valid policy status values:

- `pending`: Lead has been submitted but no policy issued yet
- `issued`: Policy has been issued but not yet paid
- `paid`: Policy has been paid for (active)
- `cancelled`: Policy was cancelled
- `rejected`: Policy application was rejected

### Response Example (Success)

```json
{
  "success": true,
  "message": "Policy update processed successfully",
  "postback_id": "123e4567-e89b-12d3-a456-426614174000",
  "lead_id": "123e4567-e89b-12d3-a456-426614174001"
}
```

### Response Example (Error)

```json
{
  "success": false,
  "error": "Lead not found"
}
```

## Integration Example

Here's how a partner might integrate with your policy postback system:

```javascript
// Example code for partners to send policy updates
async function sendPolicyUpdate(policyData) {
  try {
    const response = await fetch('https://your-domain.com/api/policy-postback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: 'your-secure-api-key-here',
        transaction_id: 'TRANS123456',
        policy_id: 'POL-987654',
        policy_status: 'issued',
        policy_carrier: 'Blue Cross Blue Shield',
        policy_type: 'Health Insurance',
        policy_premium: 349.99,
        policy_commission: 87.50,
        policy_effective_date: '2025-06-01',
        policy_notes: 'Family plan with dental coverage'
      }),
    });
    
    const data = await response.json();
    console.log('Policy update response:', data);
    return data;
  } catch (error) {
    console.error('Error sending policy update:', error);
    throw error;
  }
}
```

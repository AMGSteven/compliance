# Compliance API

## Database Setup

To set up the database tables, run the following SQL in your Supabase SQL editor:

```sql
-- Create the leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  trusted_form_cert_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS leads_email_idx ON public.leads(email);
CREATE INDEX IF NOT EXISTS leads_phone_idx ON public.leads(phone);
CREATE INDEX IF NOT EXISTS leads_status_idx ON public.leads(status);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON public.leads(created_at);
```

After creating the table, run:

```bash
npx prisma generate
```

This will update the Prisma client with the new model.

## Lead Submission API

### POST /api/leads

Submit a new lead with TrustedForm verification.

**Request Body:**
```json
{
  "firstName": "string",    // Required: First name of the lead
  "lastName": "string",     // Required: Last name of the lead
  "email": "string",       // Required: Valid email address
  "phone": "string",       // Required: Phone number (min 10 digits)
  "zipCode": "string",     // Required: ZIP code (min 5 digits)
  "trustedFormCertUrl": "string" // Required: Valid TrustedForm certificate URL
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string",
    "zipCode": "string",
    "trustedFormCertUrl": "string",
    "status": "string",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "string or array of validation errors"
}
```

**Status Codes:**
- 200: Success
- 400: Validation Error
- 500: Internal Server Error

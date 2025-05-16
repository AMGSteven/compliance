# Setting Up Email Opt-In/Opt-Out Tables in Supabase

To complete the email management system implementation, you need to run the SQL migration to create the necessary tables in your Supabase database.

## Steps to Create Email Tables

1. Log in to your Supabase dashboard
2. Select your project
3. Navigate to the SQL Editor
4. Create a new query
5. Copy and paste the following SQL:

```sql
-- Create the Email Opt-Out table
CREATE TABLE IF NOT EXISTS public.email_optouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL DEFAULT 'User opted out',
  source TEXT NOT NULL DEFAULT 'manual',
  added_by TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  expiration_date TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create the Email Opt-In table (for explicitly opted-in emails)
CREATE TABLE IF NOT EXISTS public.email_optins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual',
  added_by TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'active',
  consent_details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS email_optouts_email_idx ON public.email_optouts(email);
CREATE INDEX IF NOT EXISTS email_optouts_status_idx ON public.email_optouts(status);
CREATE INDEX IF NOT EXISTS email_optouts_date_added_idx ON public.email_optouts(date_added);

CREATE INDEX IF NOT EXISTS email_optins_email_idx ON public.email_optins(email);
CREATE INDEX IF NOT EXISTS email_optins_status_idx ON public.email_optins(status);
CREATE INDEX IF NOT EXISTS email_optins_date_added_idx ON public.email_optins(date_added);
```

6. Click "Run" to execute the query
7. Verify the tables were created by checking the Database section

## Alternatively: Use the Supabase CLI

If you prefer to use the Supabase CLI, you can run:

```bash
supabase db push
```

This will execute all migrations in your project.

## After Creating Tables

Once the tables are created, you can test the email opt-in/opt-out API endpoints:

```bash
# Add an email to the opt-out list
curl -X POST http://localhost:3000/api/email/optout \
  -H "Content-Type: application/json" \
  -H "x-api-key: test_key_123" \
  -d '{"email": "test@example.com", "first_name": "John", "last_name": "Doe", "reason": "User requested removal"}'

# Check if an email is on the opt-out list
curl "http://localhost:3000/api/email/optout?email=test@example.com&api_key=test_key_123"

# Add an email to the opt-in list
curl -X POST http://localhost:3000/api/email/optin \
  -H "Content-Type: application/json" \
  -H "x-api-key: test_key_123" \
  -d '{"email": "subscriber@example.com", "first_name": "Jane", "last_name": "Smith", "consent_details": "Subscribed via website form"}'

# Check if an email is on the opt-in list
curl "http://localhost:3000/api/email/optin?email=subscriber@example.com&api_key=test_key_123"
```

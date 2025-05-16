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

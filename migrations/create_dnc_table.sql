-- Create the DNC (Do Not Call) table
CREATE TABLE IF NOT EXISTS public.dnc_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS dnc_phone_idx ON public.dnc_entries(phone_number);
CREATE INDEX IF NOT EXISTS dnc_status_idx ON public.dnc_entries(status);
CREATE INDEX IF NOT EXISTS dnc_date_added_idx ON public.dnc_entries(date_added);

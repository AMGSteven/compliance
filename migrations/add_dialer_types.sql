-- Create dialer_types registry (global)
CREATE TABLE IF NOT EXISTS public.dialer_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  default_color VARCHAR(32),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed existing known dialers if not present
INSERT INTO public.dialer_types (id, name, slug, default_color, active)
VALUES
  (1, 'Internal Dialer', 'internal', 'bg-blue-100 text-blue-800', TRUE),
  (2, 'Pitch BPO', 'pitch-bpo', 'bg-orange-100 text-orange-800', TRUE),
  (3, 'Convoso (Health Insurance)', 'convoso', 'bg-green-100 text-green-800', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Helper trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dialer_types_updated_at ON public.dialer_types;
CREATE TRIGGER trg_dialer_types_updated_at
BEFORE UPDATE ON public.dialer_types
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

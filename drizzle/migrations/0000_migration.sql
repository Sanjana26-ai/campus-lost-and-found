CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('lost','found')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 5 AND 300),
  location text NOT NULL CHECK (char_length(btrim(location)) BETWEEN 2 AND 80),
  item_date date NOT NULL,
  contact text NOT NULL CHECK (char_length(btrim(contact)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.reports TO anon, authenticated;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reports" ON public.reports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can submit a report" ON public.reports FOR INSERT TO anon, authenticated WITH CHECK (true);
-- No UPDATE or DELETE policies: nobody can edit or remove reports through the app.

CREATE OR REPLACE FUNCTION public.reports_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.item_date > (now() AT TIME ZONE 'utc')::date + 1 THEN
    RAISE EXCEPTION 'Date cannot be in the future';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER reports_validate_trg BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.reports_validate();

CREATE INDEX reports_created_at_idx ON public.reports (created_at DESC);
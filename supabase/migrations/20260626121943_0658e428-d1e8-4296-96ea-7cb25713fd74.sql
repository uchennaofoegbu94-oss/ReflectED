
CREATE TABLE IF NOT EXISTS public.broadsheet_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_column text NOT NULL CHECK (target_column IN ('ca1','ca2','ca3','exam')),
  target_max numeric NOT NULL DEFAULT 20,
  source_field_ids uuid[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadsheet_field_mappings TO authenticated;
GRANT ALL ON public.broadsheet_field_mappings TO service_role;

ALTER TABLE public.broadsheet_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School staff can read mappings"
  ON public.broadsheet_field_mappings FOR SELECT
  TO authenticated
  USING (public.same_school(school_id));

CREATE POLICY "Admins manage mappings"
  ON public.broadsheet_field_mappings FOR ALL
  TO authenticated
  USING (
    public.same_school(school_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'principal') OR public.is_super_admin(auth.uid()))
  )
  WITH CHECK (
    public.same_school(school_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'principal') OR public.is_super_admin(auth.uid()))
  );

CREATE INDEX IF NOT EXISTS idx_bfm_school ON public.broadsheet_field_mappings(school_id);
CREATE INDEX IF NOT EXISTS idx_bfm_default ON public.broadsheet_field_mappings(school_id, is_default) WHERE is_default;

-- autofill school_id from current user when missing
CREATE OR REPLACE FUNCTION public.autofill_mapping_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    NEW.school_id := public.get_user_school_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bfm_autofill ON public.broadsheet_field_mappings;
CREATE TRIGGER trg_bfm_autofill
  BEFORE INSERT ON public.broadsheet_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.autofill_mapping_school_id();

DROP TRIGGER IF EXISTS trg_bfm_updated ON public.broadsheet_field_mappings;
CREATE TRIGGER trg_bfm_updated
  BEFORE UPDATE ON public.broadsheet_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

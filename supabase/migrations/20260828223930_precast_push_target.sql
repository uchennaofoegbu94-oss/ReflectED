-- "Push to Broadsheet" from the Pre-CA tab: a deliberate, teacher-triggered
-- copy of a Pre-CA field's scores into a designated Broadsheet field — as
-- opposed to the cross-stage COMPUTED sourcing already supported by
-- recompute_computed_broadsheet_fields(), which is a live, automatic,
-- always-on formula. Push is for the common case of seeding/syncing a
-- plain manual Broadsheet field (e.g. CA1) from Pre-CA data on demand,
-- re-runnable any time, not a permanent formula link.

ALTER TABLE public.broadsheet_fields
  ADD COLUMN push_target_field_id uuid REFERENCES public.broadsheet_fields(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_push_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
BEGIN
  IF NEW.push_target_field_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.pipeline_stage <> 'pre_ca' THEN
    RAISE EXCEPTION 'Only Pre-CA fields can have a push target';
  END IF;

  SELECT * INTO v_target FROM public.broadsheet_fields WHERE id = NEW.push_target_field_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Push target field not found';
  END IF;
  IF v_target.pipeline_stage <> 'broadsheet' THEN
    RAISE EXCEPTION 'Push target must be a Broadsheet-stage field';
  END IF;
  IF v_target.is_computed THEN
    RAISE EXCEPTION 'Push target cannot be a computed field — computed fields only accept scores written by the recompute engine';
  END IF;
  IF v_target.field_scope IS DISTINCT FROM NEW.field_scope THEN
    RAISE EXCEPTION 'Push target must share the same field scope as the source Pre-CA field';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_push_target ON public.broadsheet_fields;
CREATE TRIGGER trg_validate_push_target
  BEFORE INSERT OR UPDATE ON public.broadsheet_fields
  FOR EACH ROW EXECUTE FUNCTION public.validate_push_target();

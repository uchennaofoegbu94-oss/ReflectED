-- Generalize the Pre-CA -> Broadsheet push mechanism (20260828223930) to
-- also cover Broadsheet -> Report Card, for step 4 of the rebuild
-- ("Push to Report Card buttons/behavior on Broadsheet tab"). Same
-- validation shape, just checked by stage rank instead of hardcoding
-- 'pre_ca' -> 'broadsheet', so pipeline_stage='broadsheet' fields can now
-- also carry a push_target_field_id pointing at a report_card-stage field.

CREATE OR REPLACE FUNCTION public.validate_push_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
  v_source_rank int;
  v_target_rank int;
BEGIN
  IF NEW.push_target_field_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_source_rank := CASE NEW.pipeline_stage
    WHEN 'pre_ca' THEN 0 WHEN 'broadsheet' THEN 1 WHEN 'report_card' THEN 2 END;

  IF v_source_rank IS NULL OR v_source_rank = 2 THEN
    RAISE EXCEPTION 'Report Card fields cannot have a push target — there is no stage after Report Card';
  END IF;

  SELECT * INTO v_target FROM public.broadsheet_fields WHERE id = NEW.push_target_field_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Push target field not found';
  END IF;

  v_target_rank := CASE v_target.pipeline_stage
    WHEN 'pre_ca' THEN 0 WHEN 'broadsheet' THEN 1 WHEN 'report_card' THEN 2 END;

  IF v_target_rank IS DISTINCT FROM v_source_rank + 1 THEN
    RAISE EXCEPTION 'Push target must be a field in the very next pipeline stage';
  END IF;
  IF v_target.is_computed THEN
    RAISE EXCEPTION 'Push target cannot be a computed field — computed fields only accept scores written by the recompute engine';
  END IF;
  IF v_target.field_scope IS DISTINCT FROM NEW.field_scope THEN
    RAISE EXCEPTION 'Push target must share the same field scope as the source field';
  END IF;

  RETURN NEW;
END;
$$;
-- Trigger definition (name, timing, table) is unchanged from the prior
-- migration — CREATE OR REPLACE above is sufficient, no need to redrop/recreate.

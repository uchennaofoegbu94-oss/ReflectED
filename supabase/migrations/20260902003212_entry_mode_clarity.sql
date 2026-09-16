-- Clarity fix for a confusing-looking (though logically not contradictory
-- under the old messages) entry-mode rejection pattern: error text now
-- names the field's pipeline stage too, so if a "CA1" in Pre-CA and a
-- differently-configured "CA1" in Broadsheet are ever mixed up (same
-- name, different row, different entry_mode), the two error messages no
-- longer look like they're describing the same field.
CREATE OR REPLACE FUNCTION public.enforce_entry_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field RECORD;
  v_locked boolean;
  v_stage_label text;
BEGIN
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_field FROM public.broadsheet_fields WHERE id = NEW.field_id;

  IF v_field.is_computed THEN
    RETURN NEW;
  END IF;

  SELECT locked INTO v_locked FROM public.pipeline_stage_locks
    WHERE school_id = v_field.school_id AND pipeline_stage = v_field.pipeline_stage;

  IF NOT COALESCE(v_locked, false) THEN
    RETURN NEW;
  END IF;

  v_stage_label := CASE v_field.pipeline_stage
    WHEN 'pre_ca' THEN 'Pre-CA' WHEN 'broadsheet' THEN 'Broadsheet' ELSE 'Report Card' END;

  IF v_field.entry_mode = 'manual' AND NEW.source_type IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION '% field "%" is locked as manual-entry only — it cannot be filled by a push', v_stage_label, v_field.name;
  END IF;

  IF v_field.entry_mode = 'push' AND NEW.source_type = 'manual' THEN
    RAISE EXCEPTION '% field "%" is locked as push-sourced only — enter its score via the linked quiz/assignment/push, not manually', v_stage_label, v_field.name;
  END IF;

  RETURN NEW;
END;
$$;

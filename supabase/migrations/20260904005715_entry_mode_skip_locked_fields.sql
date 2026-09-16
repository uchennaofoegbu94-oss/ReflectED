-- Real bug: enforce_entry_mode only exempted is_computed fields, not
-- is_locked ones. Final Total/Average (field_scope='final', is_locked=true)
-- use a completely separate auto-computation mechanism
-- (recompute_final_totals) — they were never meant to go through the
-- manual/push entry_mode system, and were excluded from the Manage Fields
-- UI entirely, so their entry_mode sat stuck at the column default
-- ('manual') with no way to ever set it correctly. Once a school locked
-- the Broadsheet stage, every automatic Final Total/Average recalculation
-- started being rejected by this trigger — surfacing as a confusing toast
-- ("Broadsheet field 'Final Total' is locked as manual-entry only...")
-- during what looked like an unrelated quiz/assignment push, because the
-- push's cascade of writes is what triggered the recalculation in the
-- first place.
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

  -- Computed fields (is_computed) and system-locked fields (is_locked —
  -- Final Total/Average and any future equivalents) both have their own
  -- dedicated write mechanisms and are never subject to entry_mode.
  IF v_field.is_computed OR v_field.is_locked THEN
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

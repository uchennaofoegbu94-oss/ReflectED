-- Two related changes:
--
-- 1. Report Card stops being a separate set of admin-managed fields with
-- its own push-target wiring. It now just MIRRORS Broadsheet fields
-- directly — a boolean per Broadsheet field controls whether it shows on
-- the report card. No separate rows, no separate push needed for this
-- leg of the pipeline at all: Report Card reads Broadsheet's own scores
-- live. (Old pipeline_stage='report_card' broadsheet_fields rows and any
-- push_target_field_id pointing at them are left alone, not deleted —
-- they just stop being rendered anywhere going forward.)
--
-- 2. Pre-CA -> Broadsheet now propagates automatically the instant a
-- Pre-CA score is saved (manual entry, or the quiz/assignment auto-push),
-- rather than requiring a manual "Push to Broadsheet" click. This is what
-- makes push_target_field_id + entry_mode meaningful moment-to-moment,
-- and is why the "nothing to push yet" complaint mostly goes away: by the
-- time anyone would click a manual push button, the data is usually
-- already there. The manual push button stays as a backfill/re-sync
-- fallback (e.g. after a push_target_field_id is set retroactively).

ALTER TABLE public.broadsheet_fields
  ADD COLUMN IF NOT EXISTS show_on_report_card boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.auto_push_to_next_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field RECORD;
  v_target RECORD;
  v_locked boolean;
BEGIN
  IF NEW.score IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_field FROM public.broadsheet_fields WHERE id = NEW.field_id;
  IF v_field.push_target_field_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Checked here, not left to the cascading INSERT's own enforce_entry_mode
  -- trigger: if that trigger raised instead, the exception would roll back
  -- this WHOLE transaction — failing the original Pre-CA save over a
  -- Broadsheet-side lock the teacher never touched. Silently skipping the
  -- auto-push (the Pre-CA save still succeeds) is the safe behavior;
  -- admin/principal can always reconcile manually afterward.
  SELECT * INTO v_target FROM public.broadsheet_fields WHERE id = v_field.push_target_field_id;
  IF v_target.is_computed OR v_target.entry_mode = 'manual' THEN
    SELECT locked INTO v_locked FROM public.pipeline_stage_locks
      WHERE school_id = v_target.school_id AND pipeline_stage = v_target.pipeline_stage;
    IF COALESCE(v_locked, false) AND NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type, source_id, entered_by, school_id)
  VALUES
    (v_field.push_target_field_id, NEW.student_id, NEW.subject_id, NEW.term_id, NEW.score,
     'pushed', v_field.id, NEW.entered_by, NEW.school_id)
  ON CONFLICT (field_id, student_id, subject_id, term_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    source_type = EXCLUDED.source_type,
    source_id = EXCLUDED.source_id,
    entered_by = EXCLUDED.entered_by,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_push_to_next_stage ON public.broadsheet_field_scores;
CREATE TRIGGER trg_auto_push_to_next_stage
  AFTER INSERT OR UPDATE OF score ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.auto_push_to_next_stage();

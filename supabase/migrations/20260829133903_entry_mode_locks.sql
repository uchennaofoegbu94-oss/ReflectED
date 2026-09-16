-- Admin/principal-controlled "entry mode" per field (manual vs push-
-- sourced) plus a per-stage lock that, once switched on, enforces it:
-- a manual field can never be overwritten by a push, and a push-target
-- field can never be overwritten by manual typing. Before a stage is
-- locked, both are allowed on any non-computed field (keeps setup/
-- testing flexible for admins configuring the pipeline).
--
-- Deliberately a NEW dedicated table (pipeline_stage_locks) rather than
-- reusing public.school_settings for these locks: school_settings has
-- no school_id column at all (key is globally UNIQUE across the whole
-- platform, not per-school) — every school currently shares the same
-- proctor_mode/report-card-restriction/etc. values. That's a pre-existing
-- cross-tenant bug, not something this migration should build on top of
-- or silently fix (out of scope here — flagged separately). This table
-- is scoped correctly from the start.

CREATE TABLE public.pipeline_stage_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  pipeline_stage text NOT NULL CHECK (pipeline_stage IN ('pre_ca', 'broadsheet', 'report_card')),
  locked boolean NOT NULL DEFAULT false,
  locked_by uuid,
  locked_at timestamptz,
  UNIQUE (school_id, pipeline_stage)
);

ALTER TABLE public.pipeline_stage_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view pipeline locks" ON public.pipeline_stage_locks
  FOR SELECT TO authenticated USING (same_school(school_id));

CREATE POLICY "Admins manage pipeline locks" ON public.pipeline_stage_locks
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

-- Entry mode: which of the two protected write-paths a non-computed field
-- accepts. NULL/'manual' is the default (matches every existing field's
-- current, unrestricted behavior until a stage is actually locked).
ALTER TABLE public.broadsheet_fields
  ADD COLUMN entry_mode text NOT NULL DEFAULT 'manual' CHECK (entry_mode IN ('manual', 'push'));

CREATE OR REPLACE FUNCTION public.enforce_entry_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field RECORD;
  v_locked boolean;
BEGIN
  -- The lock is explicitly teacher-side only — admin/principal can always
  -- manually correct a push-sourced field or re-push into a manual one;
  -- "editable afterwards" is what admin/principal keeps even once locked.
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_field FROM public.broadsheet_fields WHERE id = NEW.field_id;

  -- Computed fields are already fully guarded by guard_computed_field_scores
  -- (only source_type='computed' writes ever reach them) — entry_mode is
  -- meaningless there.
  IF v_field.is_computed THEN
    RETURN NEW;
  END IF;

  SELECT locked INTO v_locked FROM public.pipeline_stage_locks
    WHERE school_id = v_field.school_id AND pipeline_stage = v_field.pipeline_stage;

  IF NOT COALESCE(v_locked, false) THEN
    RETURN NEW;
  END IF;

  IF v_field.entry_mode = 'manual' AND NEW.source_type IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'This field ("%") is locked as manual-entry only — it cannot be filled by a push', v_field.name;
  END IF;

  IF v_field.entry_mode = 'push' AND NEW.source_type = 'manual' THEN
    RAISE EXCEPTION 'This field ("%") is locked as push-sourced only — enter its score via the linked quiz/assignment/push, not manually', v_field.name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_entry_mode ON public.broadsheet_field_scores;
CREATE TRIGGER trg_enforce_entry_mode
  BEFORE INSERT OR UPDATE ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.enforce_entry_mode();

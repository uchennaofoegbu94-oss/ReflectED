-- Results pipeline rearchitecture (Pre-CA -> Broadsheet -> Report Card ->
-- Transcript), part 1: schema. Full design rationale lives in
-- explainer.md delivered alongside this migration — comments here cover
-- only what each piece does, not why the pipeline is shaped this way.

-- ── 1. pipeline_stage: which tier of the pipeline a field belongs to ────

ALTER TABLE public.broadsheet_fields
  ADD COLUMN pipeline_stage text NOT NULL DEFAULT 'pre_ca'
    CHECK (pipeline_stage IN ('pre_ca', 'broadsheet', 'report_card'));

-- The existing Final Total/Average system fields ARE the Broadsheet's
-- "Finals section" the user described — no new fields needed for that,
-- just an explicit stage label on what already exists.
UPDATE public.broadsheet_fields SET pipeline_stage = 'broadsheet' WHERE field_scope = 'final';

-- Marks the 4 fields seeded below (CA1/CA2/CA3/Exam) so a write-through
-- trigger can keep the legacy assessment_scores.ca1/ca2/ca3/exam columns
-- in sync automatically. Deliberately NOT computation_key: those 4 fields
-- must stay fully admin-CRUD-able (rename, re-max, delete) per spec —
-- computation_key would lock them via the existing
-- guard_system_broadsheet_field trigger, which this must not do.
ALTER TABLE public.broadsheet_fields
  ADD COLUMN legacy_ca_slot text CHECK (legacy_ca_slot IN ('ca1', 'ca2', 'ca3', 'exam'));

CREATE UNIQUE INDEX broadsheet_fields_legacy_ca_slot_per_school
  ON public.broadsheet_fields (school_id, legacy_ca_slot)
  WHERE legacy_ca_slot IS NOT NULL;

-- Report Card's own system final fields need a couple more computation_key
-- values than the CHECK on broadsheet_fields currently allows.
ALTER TABLE public.broadsheet_fields DROP CONSTRAINT broadsheet_fields_computation_key_check;
ALTER TABLE public.broadsheet_fields
  ADD CONSTRAINT broadsheet_fields_computation_key_check
  CHECK (computation_key IN ('final_total', 'final_average', 'rc_final_total', 'rc_final_average'));

-- ── 2. Formula sourcing stays within one stage ───────────────────────────
-- Cross-stage composition (Pre-CA fields feeding a Broadsheet field, etc.)
-- happens through the push/commit mechanism, not the formula engine — see
-- explainer.md. A computed field's sources must match both its scope
-- (already enforced) and now its stage too.
CREATE OR REPLACE FUNCTION public.prevent_computed_field_cycles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle boolean;
  v_mismatch boolean;
BEGIN
  IF NEW.is_computed IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.id = ANY(NEW.formula_source_field_ids) THEN
    RAISE EXCEPTION 'A computed field cannot reference itself';
  END IF;

  IF NEW.formula_source_field_ids IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.broadsheet_fields bf
      WHERE bf.id = ANY(NEW.formula_source_field_ids)
        AND (bf.field_scope IS DISTINCT FROM NEW.field_scope OR bf.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage)
    ) INTO v_mismatch;

    IF v_mismatch THEN
      RAISE EXCEPTION 'A computed field can only source fields in the same pipeline stage and scope';
    END IF;
  END IF;

  WITH RECURSIVE deps AS (
    SELECT unnest(NEW.formula_source_field_ids) AS field_id
    UNION
    SELECT unnest(bf.formula_source_field_ids)
    FROM public.broadsheet_fields bf
    JOIN deps d ON bf.id = d.field_id
    WHERE bf.is_computed = true AND bf.formula_source_field_ids IS NOT NULL
  )
  SELECT EXISTS(SELECT 1 FROM deps WHERE field_id = NEW.id) INTO v_cycle;

  IF v_cycle THEN
    RAISE EXCEPTION 'Circular reference detected: this formula would depend on itself through another computed field';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Seed the 4 legacy-named Broadsheet fields per school ─────────────
-- Same labels/max points assessment_scores.ca1/ca2/ca3/exam already use,
-- so nothing changes for a school that never touches the new field
-- system — these are just that same data, now also addressable as real,
-- renamable, deletable fields.

INSERT INTO public.broadsheet_fields
  (school_id, name, field_order, is_active, max_points, pipeline_stage, field_scope, legacy_ca_slot, created_by)
SELECT s.id, label.name, label.ord, true, label.max_points, 'broadsheet', 'subject', label.slot,
  COALESCE(s.created_by, (SELECT user_id FROM public.user_roles WHERE school_id = s.id AND role = 'admin' LIMIT 1))
FROM public.schools s
CROSS JOIN (VALUES
  ('CA1', 0, 20, 'ca1'), ('CA2', 1, 20, 'ca2'), ('CA3', 2, 20, 'ca3'), ('Exam', 3, 40, 'exam')
) AS label(name, ord, max_points, slot)
WHERE NOT EXISTS (
  SELECT 1 FROM public.broadsheet_fields bf WHERE bf.school_id = s.id AND bf.legacy_ca_slot = label.slot
);

CREATE OR REPLACE FUNCTION public.seed_legacy_ca_broadsheet_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.broadsheet_fields
    (school_id, name, field_order, is_active, max_points, pipeline_stage, field_scope, legacy_ca_slot, created_by)
  VALUES
    (NEW.id, 'CA1', 0, true, 20, 'broadsheet', 'subject', 'ca1', NEW.created_by),
    (NEW.id, 'CA2', 1, true, 20, 'broadsheet', 'subject', 'ca2', NEW.created_by),
    (NEW.id, 'CA3', 2, true, 20, 'broadsheet', 'subject', 'ca3', NEW.created_by),
    (NEW.id, 'Exam', 3, true, 40, 'broadsheet', 'subject', 'exam', NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_legacy_ca_broadsheet_fields ON public.schools;
CREATE TRIGGER trg_seed_legacy_ca_broadsheet_fields
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.seed_legacy_ca_broadsheet_fields();

-- Backfill: copy existing assessment_scores.ca1/ca2/ca3/exam values into
-- broadsheet_field_scores rows on the matching legacy field, so the new
-- tier starts populated instead of empty.
INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT bf.id, a.student_id, a.subject_id, a.term_id, a.ca1, 'legacy_sync'
FROM public.assessment_scores a
JOIN public.broadsheet_fields bf ON bf.school_id = a.school_id AND bf.legacy_ca_slot = 'ca1'
WHERE a.ca1 IS NOT NULL
ON CONFLICT (field_id, student_id, subject_id, term_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now();

INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT bf.id, a.student_id, a.subject_id, a.term_id, a.ca2, 'legacy_sync'
FROM public.assessment_scores a
JOIN public.broadsheet_fields bf ON bf.school_id = a.school_id AND bf.legacy_ca_slot = 'ca2'
WHERE a.ca2 IS NOT NULL
ON CONFLICT (field_id, student_id, subject_id, term_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now();

INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT bf.id, a.student_id, a.subject_id, a.term_id, a.ca3, 'legacy_sync'
FROM public.assessment_scores a
JOIN public.broadsheet_fields bf ON bf.school_id = a.school_id AND bf.legacy_ca_slot = 'ca3'
WHERE a.ca3 IS NOT NULL
ON CONFLICT (field_id, student_id, subject_id, term_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now();

INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT bf.id, a.student_id, a.subject_id, a.term_id, a.exam, 'legacy_sync'
FROM public.assessment_scores a
JOIN public.broadsheet_fields bf ON bf.school_id = a.school_id AND bf.legacy_ca_slot = 'exam'
WHERE a.exam IS NOT NULL
ON CONFLICT (field_id, student_id, subject_id, term_id) DO UPDATE SET score = EXCLUDED.score, updated_at = now();

-- Going forward: any push/commit into one of the 4 legacy fields writes
-- through to assessment_scores automatically, so report cards/transcripts
-- (which still read assessment_scores directly — see explainer.md for
-- what's deliberately out of scope this pass) keep working unchanged
-- regardless of whether the write came via the old direct-to-CA path or
-- the new dynamic field system.
CREATE OR REPLACE FUNCTION public.sync_legacy_ca_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot text;
  v_user_id uuid;
BEGIN
  SELECT legacy_ca_slot INTO v_slot FROM public.broadsheet_fields WHERE id = NEW.field_id;
  IF v_slot IS NULL OR NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_user_id := COALESCE(NEW.entered_by, auth.uid());

  EXECUTE format(
    'INSERT INTO public.assessment_scores (student_id, subject_id, term_id, %1$I, entered_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (student_id, subject_id, term_id)
     DO UPDATE SET %1$I = $4, entered_by = COALESCE($5, public.assessment_scores.entered_by)',
    v_slot
  ) USING NEW.student_id, NEW.subject_id, NEW.term_id, NEW.score, v_user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_ca_column ON public.broadsheet_field_scores;
CREATE TRIGGER trg_sync_legacy_ca_column
  AFTER INSERT OR UPDATE ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_ca_column();

-- ── 4. Report Card stage: system final fields mirroring the Broadsheet's ─

INSERT INTO public.broadsheet_fields
  (school_id, name, description, field_order, is_active, max_points, pipeline_stage, field_scope, is_locked, computation_key, created_by)
SELECT s.id, 'Final Total', 'Mirrors the Broadsheet''s Final Total. Calculated automatically.',
  -1000, true, 1000, 'report_card', 'final', true, 'rc_final_total',
  COALESCE(s.created_by, (SELECT user_id FROM public.user_roles WHERE school_id = s.id AND role = 'admin' LIMIT 1))
FROM public.schools s
WHERE NOT EXISTS (SELECT 1 FROM public.broadsheet_fields bf WHERE bf.school_id = s.id AND bf.computation_key = 'rc_final_total');

INSERT INTO public.broadsheet_fields
  (school_id, name, description, field_order, is_active, max_points, pipeline_stage, field_scope, is_locked, computation_key, created_by)
SELECT s.id, 'Final Average', 'Mirrors the Broadsheet''s Final Average. Calculated automatically.',
  -999, true, 100, 'report_card', 'final', true, 'rc_final_average',
  COALESCE(s.created_by, (SELECT user_id FROM public.user_roles WHERE school_id = s.id AND role = 'admin' LIMIT 1))
FROM public.schools s
WHERE NOT EXISTS (SELECT 1 FROM public.broadsheet_fields bf WHERE bf.school_id = s.id AND bf.computation_key = 'rc_final_average');

CREATE OR REPLACE FUNCTION public.seed_report_card_final_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.broadsheet_fields
    (school_id, name, description, field_order, is_active, max_points, pipeline_stage, field_scope, is_locked, computation_key, created_by)
  VALUES
    (NEW.id, 'Final Total', 'Mirrors the Broadsheet''s Final Total. Calculated automatically.',
     -1000, true, 1000, 'report_card', 'final', true, 'rc_final_total', NEW.created_by),
    (NEW.id, 'Final Average', 'Mirrors the Broadsheet''s Final Average. Calculated automatically.',
     -999, true, 100, 'report_card', 'final', true, 'rc_final_average', NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_report_card_final_fields ON public.schools;
CREATE TRIGGER trg_seed_report_card_final_fields
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.seed_report_card_final_fields();

-- Mirrors Broadsheet final scores into Report Card final scores whenever
-- the Broadsheet side changes (fires from the SAME recompute_final_totals
-- trigger path, since that's what writes broadsheet-stage 'final' scores).
CREATE OR REPLACE FUNCTION public.mirror_broadsheet_finals_to_report_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_key text;
  v_target_key text;
  v_school_id uuid;
  v_target_field_id uuid;
BEGIN
  SELECT computation_key, school_id INTO v_source_key, v_school_id
  FROM public.broadsheet_fields WHERE id = NEW.field_id;

  IF v_source_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_target_key := CASE v_source_key WHEN 'final_total' THEN 'rc_final_total'
                                     WHEN 'final_average' THEN 'rc_final_average'
                                     ELSE NULL END;
  IF v_target_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_target_field_id FROM public.broadsheet_fields
    WHERE school_id = v_school_id AND computation_key = v_target_key;
  IF v_target_field_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES (v_target_field_id, NEW.student_id, NULL, NEW.term_id, NEW.score, 'system_final')
  ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_broadsheet_finals ON public.broadsheet_field_scores;
CREATE TRIGGER trg_mirror_broadsheet_finals
  AFTER INSERT OR UPDATE ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.mirror_broadsheet_finals_to_report_card();

-- Backfill: mirror whatever Broadsheet final scores already exist.
INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT rc.id, src.student_id, NULL, src.term_id, src.score, 'system_final'
FROM public.broadsheet_field_scores src
JOIN public.broadsheet_fields srcf ON srcf.id = src.field_id AND srcf.computation_key = 'final_total'
JOIN public.broadsheet_fields rc ON rc.school_id = srcf.school_id AND rc.computation_key = 'rc_final_total'
ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
DO UPDATE SET score = EXCLUDED.score, updated_at = now();

INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT rc.id, src.student_id, NULL, src.term_id, src.score, 'system_final'
FROM public.broadsheet_field_scores src
JOIN public.broadsheet_fields srcf ON srcf.id = src.field_id AND srcf.computation_key = 'final_average'
JOIN public.broadsheet_fields rc ON rc.school_id = srcf.school_id AND rc.computation_key = 'rc_final_average'
ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
DO UPDATE SET score = EXCLUDED.score, updated_at = now();

-- guard_system_field_scores (from the Tier 5 migration) already rejects
-- any write to a computation_key field with source_type != 'system_final'
-- — that check applies unchanged to the 2 new rc_* keys, so nothing here
-- can write into them except this mirror trigger.

-- ── 5. Mapping presets: target a real field, not a hardcoded CA name ────
-- Old presets keep working (target_column still resolves to the matching
-- legacy field below); new presets should be saved with target_field_id.
ALTER TABLE public.broadsheet_field_mappings
  ALTER COLUMN target_column DROP NOT NULL,
  ADD COLUMN target_field_id uuid REFERENCES public.broadsheet_fields(id) ON DELETE SET NULL;

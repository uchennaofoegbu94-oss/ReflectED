-- Tier 5 / #7: Broadsheet "Final" section.
--
-- Confirmed requirements:
--   1. Final Total = sum of all subject totals; Final Average = Final Total
--      / subject count; Final Grade = looked up from Final Average via
--      grading_scales (mirrors useResults.ts's existing gradeForAverage,
--      not stored — see note near the bottom).
--   2. Field CRUD is per-school (already true of broadsheet_fields today).
--   3. Locking a field freezes compute/propagation behavior only — new
--      entries still allowed; it exists specifically to stop a push from a
--      *different* source silently overwriting a locked field's value.
--
-- The existing computed-field engine (is_computed / formula_operation /
-- formula_source_field_ids, see 20260727020009) aggregates *other fields
-- within one subject* for one student+term. Final Total/Average need a
-- different aggregation axis — across every subject for a student+term —
-- so this adds a second, purpose-built mechanism rather than stretching
-- the subject-scoped one to cover both.

-- ── 1. Scope + lock + system-field identity on broadsheet_fields ──────────

ALTER TABLE public.broadsheet_fields
  ADD COLUMN field_scope text NOT NULL DEFAULT 'subject'
    CHECK (field_scope IN ('subject', 'final')),
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
  -- Identifies the two system-managed Final fields reliably even if an
  -- admin renames them — matching by display name would break on rename.
  -- NULL for every ordinary (admin-created) field.
  ADD COLUMN computation_key text
    CHECK (computation_key IN ('final_total', 'final_average'));

-- One "Final Total" / one "Final Average" per school, not per anything else.
CREATE UNIQUE INDEX broadsheet_fields_computation_key_per_school
  ON public.broadsheet_fields (school_id, computation_key)
  WHERE computation_key IS NOT NULL;

-- System-seeded rows have no human creator. created_by predates school_id
-- (added back in the original table) and was NOT NULL with no FK — loosen
-- it rather than inventing a placeholder user id.
ALTER TABLE public.broadsheet_fields ALTER COLUMN created_by DROP NOT NULL;

-- A computed field (formula engine) may only source from fields in its own
-- scope — a 'final'-scope formula sourcing a 'subject'-scope field (or vice
-- versa) would join against rows that can never match (see subject_id
-- handling below) and silently sit "pending" forever. Extends the existing
-- cycle-prevention trigger rather than adding a separate one, since both
-- are formula-integrity checks on the same BEFORE INSERT/UPDATE path.
CREATE OR REPLACE FUNCTION public.prevent_computed_field_cycles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle boolean;
  v_scope_mismatch boolean;
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
        AND bf.field_scope IS DISTINCT FROM NEW.field_scope
    ) INTO v_scope_mismatch;

    IF v_scope_mismatch THEN
      RAISE EXCEPTION 'A computed field can only source fields in the same scope (subject vs final)';
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

-- Protects the two system fields from being deleted, or having their
-- identity (scope/computation_key) changed out from under the recompute
-- trigger below. Renaming, toggling is_active/is_locked, editing
-- description, etc. all remain allowed.
CREATE OR REPLACE FUNCTION public.guard_system_broadsheet_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.computation_key IS NOT NULL THEN
      RAISE EXCEPTION 'This is a system-managed field (%) and cannot be deleted', OLD.computation_key;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.computation_key IS NOT NULL AND (
    NEW.computation_key IS DISTINCT FROM OLD.computation_key
    OR NEW.field_scope IS DISTINCT FROM OLD.field_scope
  ) THEN
    RAISE EXCEPTION 'The scope/identity of a system-managed field (%) cannot be changed', OLD.computation_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_system_broadsheet_field ON public.broadsheet_fields;
CREATE TRIGGER trg_guard_system_broadsheet_field
  BEFORE UPDATE OR DELETE ON public.broadsheet_fields
  FOR EACH ROW EXECUTE FUNCTION public.guard_system_broadsheet_field();

-- ── 2. broadsheet_field_scores: Final fields aren't tied to one subject ───

ALTER TABLE public.broadsheet_field_scores ALTER COLUMN subject_id DROP NOT NULL;

-- Same class of NULL-handling gap as the attendance daily-record fix
-- (20260804001841): the existing UNIQUE(field_id, student_id, subject_id,
-- term_id) treats every NULL subject_id as distinct, so it would silently
-- allow duplicate Final-field rows per student+term. Partial index closes
-- that specifically for the subject_id IS NULL case.
CREATE UNIQUE INDEX broadsheet_field_scores_final_unique
  ON public.broadsheet_field_scores (field_id, student_id, term_id)
  WHERE subject_id IS NULL;

-- A 'final'-scope field's scores must have subject_id NULL; a
-- 'subject'-scope field's scores must have it set. Keeps the two
-- aggregation axes from ever crossing.
CREATE OR REPLACE FUNCTION public.guard_field_score_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text;
BEGIN
  SELECT field_scope INTO v_scope FROM public.broadsheet_fields WHERE id = NEW.field_id;

  IF v_scope = 'final' AND NEW.subject_id IS NOT NULL THEN
    RAISE EXCEPTION 'A final-scope field score cannot be tied to a single subject';
  ELSIF v_scope = 'subject' AND NEW.subject_id IS NULL THEN
    RAISE EXCEPTION 'A subject-scope field score must specify a subject';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_field_score_scope ON public.broadsheet_field_scores;
CREATE TRIGGER trg_guard_field_score_scope
  BEFORE INSERT OR UPDATE ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.guard_field_score_scope();

-- Only the recompute trigger below may write a system field's score —
-- distinct from source_type = 'computed' (the formula engine), so the two
-- mechanisms can't be confused with each other or overwrite one another.
CREATE OR REPLACE FUNCTION public.guard_system_field_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_computation_key text;
BEGIN
  SELECT computation_key INTO v_computation_key FROM public.broadsheet_fields WHERE id = NEW.field_id;
  IF v_computation_key IS NOT NULL AND NEW.source_type IS DISTINCT FROM 'system_final' THEN
    RAISE EXCEPTION 'This field (%) is calculated automatically from subject totals and cannot be scored directly', v_computation_key;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_system_field_scores ON public.broadsheet_field_scores;
CREATE TRIGGER trg_guard_system_field_scores
  BEFORE INSERT OR UPDATE ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.guard_system_field_scores();

-- ── 3. Seed the two system fields ──────────────────────────────────────

INSERT INTO public.broadsheet_fields
  (school_id, name, description, field_order, is_active, max_points,
   field_scope, is_locked, computation_key, created_by)
SELECT
  s.id,
  'Final Total',
  'Sum of every subject''s total for the term. Calculated automatically.',
  -1000, true, 1000, 'final', true, 'final_total',
  COALESCE(
    s.created_by,
    (SELECT ur.user_id FROM public.user_roles ur WHERE ur.school_id = s.id AND ur.role = 'admin' LIMIT 1),
    (SELECT ur.user_id FROM public.user_roles ur WHERE ur.school_id = s.id AND ur.role = 'principal' LIMIT 1)
  )
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.broadsheet_fields bf WHERE bf.school_id = s.id AND bf.computation_key = 'final_total'
);

INSERT INTO public.broadsheet_fields
  (school_id, name, description, field_order, is_active, max_points,
   field_scope, is_locked, computation_key, created_by)
SELECT
  s.id,
  'Final Average',
  'Final Total divided by subject count for the term. Calculated automatically.',
  -999, true, 100, 'final', true, 'final_average',
  COALESCE(
    s.created_by,
    (SELECT ur.user_id FROM public.user_roles ur WHERE ur.school_id = s.id AND ur.role = 'admin' LIMIT 1),
    (SELECT ur.user_id FROM public.user_roles ur WHERE ur.school_id = s.id AND ur.role = 'principal' LIMIT 1)
  )
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.broadsheet_fields bf WHERE bf.school_id = s.id AND bf.computation_key = 'final_average'
);

-- Seed the same two fields for every new school going forward. First
-- trigger ever installed on public.schools.
CREATE OR REPLACE FUNCTION public.seed_final_broadsheet_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.broadsheet_fields
    (school_id, name, description, field_order, is_active, max_points,
     field_scope, is_locked, computation_key, created_by)
  VALUES
    (NEW.id, 'Final Total',
     'Sum of every subject''s total for the term. Calculated automatically.',
     -1000, true, 1000, 'final', true, 'final_total', NEW.created_by),
    (NEW.id, 'Final Average',
     'Final Total divided by subject count for the term. Calculated automatically.',
     -999, true, 100, 'final', true, 'final_average', NEW.created_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_final_broadsheet_fields ON public.schools;
CREATE TRIGGER trg_seed_final_broadsheet_fields
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.seed_final_broadsheet_fields();

-- ── 4. The recompute itself ────────────────────────────────────────────

-- Fires after any write to assessment_scores that could change a student's
-- subject totals for a term (insert, delete, or an update that touches the
-- generated `total` column — which itself only changes when ca1/ca2/ca3/exam
-- do). Recomputes that student+term's Final Total/Average and upserts them
-- as 'system_final' scores on the school's two system fields.
--
-- Deliberately ignores is_locked: per the confirmed requirement, locking a
-- Final field blocks a *different source* from pushing into it — it does
-- not suspend the field's own defined (automatic) behavior.
CREATE OR REPLACE FUNCTION public.recompute_final_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_term_id uuid;
  v_school_id uuid;
  v_total_field_id uuid;
  v_avg_field_id uuid;
  v_count integer;
  v_sum numeric;
  v_avg numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    v_term_id := OLD.term_id;
    v_school_id := OLD.school_id;
  ELSE
    v_student_id := NEW.student_id;
    v_term_id := NEW.term_id;
    v_school_id := NEW.school_id;
  END IF;

  IF v_school_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_total_field_id FROM public.broadsheet_fields
    WHERE school_id = v_school_id AND computation_key = 'final_total';
  SELECT id INTO v_avg_field_id FROM public.broadsheet_fields
    WHERE school_id = v_school_id AND computation_key = 'final_average';

  -- Defensive no-op: a school predating this migration's seed pass, or one
  -- where the system field was somehow removed before the delete-guard
  -- above existed. Never fail the underlying assessment_scores write over
  -- a missing config row.
  IF v_total_field_id IS NULL OR v_avg_field_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- subject count = number of assessment_scores rows for this student+term
  -- (not "rows with a non-zero total"), matching useResults.ts's existing
  -- client-side Final Total/Average calculation exactly.
  SELECT count(*), COALESCE(sum(total), 0)
    INTO v_count, v_sum
    FROM public.assessment_scores
    WHERE student_id = v_student_id AND term_id = v_term_id;

  v_avg := CASE WHEN v_count > 0 THEN round(v_sum / v_count, 2) ELSE NULL END;

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES
    (v_total_field_id, v_student_id, NULL, v_term_id,
     CASE WHEN v_count > 0 THEN v_sum ELSE NULL END, 'system_final')
  ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES
    (v_avg_field_id, v_student_id, NULL, v_term_id, v_avg, 'system_final')
  ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_final_totals ON public.assessment_scores;
CREATE TRIGGER trg_recompute_final_totals
  AFTER INSERT OR UPDATE OF total OR DELETE ON public.assessment_scores
  FOR EACH ROW EXECUTE FUNCTION public.recompute_final_totals();

-- Final Grade is deliberately NOT stored as its own field/row — derived at
-- read time from Final Average + grading_scales, exactly mirroring the
-- pattern useResults.ts already uses for report-card grades. Avoids a
-- sync-drift risk between a stored grade and a scale an admin edits later.

-- ── 5. Backfill existing data ──────────────────────────────────────────

WITH agg AS (
  SELECT student_id, term_id, school_id, count(*) AS cnt, COALESCE(sum(total), 0) AS total_sum
  FROM public.assessment_scores
  GROUP BY student_id, term_id, school_id
)
INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT bf.id, agg.student_id, NULL, agg.term_id,
       CASE WHEN agg.cnt > 0 THEN agg.total_sum ELSE NULL END, 'system_final'
FROM agg
JOIN public.broadsheet_fields bf ON bf.school_id = agg.school_id AND bf.computation_key = 'final_total'
ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
DO UPDATE SET score = EXCLUDED.score, updated_at = now();

WITH agg AS (
  SELECT student_id, term_id, school_id, count(*) AS cnt, COALESCE(sum(total), 0) AS total_sum
  FROM public.assessment_scores
  GROUP BY student_id, term_id, school_id
)
INSERT INTO public.broadsheet_field_scores (field_id, student_id, subject_id, term_id, score, source_type)
SELECT bf.id, agg.student_id, NULL, agg.term_id,
       CASE WHEN agg.cnt > 0 THEN round(agg.total_sum / agg.cnt, 2) ELSE NULL END, 'system_final'
FROM agg
JOIN public.broadsheet_fields bf ON bf.school_id = agg.school_id AND bf.computation_key = 'final_average'
ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
DO UPDATE SET score = EXCLUDED.score, updated_at = now();

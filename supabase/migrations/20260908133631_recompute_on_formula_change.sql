-- Bug: editing a computed field's formula (formula_operation or
-- formula_source_field_ids, via Manage Fields) never recomputed scores
-- that were already stored for that field. recompute_computed_broadsheet_fields
-- only ever fires off a WRITE to a *source* field's score
-- (trg_recompute_computed_fields, on broadsheet_field_scores) — changing
-- the formula itself doesn't touch broadsheet_field_scores at all, so
-- every existing row for the computed field silently kept reflecting
-- its OLD formula until some unrelated future score edit happened to
-- touch a source field again.
--
-- Fix: factor the per-student/subject/term computation out of the
-- existing trigger function into a reusable one, and add a new trigger
-- on broadsheet_fields itself that walks every (student, subject, term)
-- combo with at least one existing score among the field's (new) source
-- fields and recomputes this field's score for each, the moment the
-- formula changes.

CREATE OR REPLACE FUNCTION public.recompute_one_computed_field(
  _field_id uuid,
  _formula_operation text,
  _formula_source_field_ids uuid[],
  _student_id uuid,
  _subject_id uuid,
  _term_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all_present boolean;
  v_sum numeric;
  v_avg numeric;
  v_max numeric;
  v_min numeric;
  v_result numeric;
BEGIN
  SELECT
    bool_and(bfs.score IS NOT NULL),
    sum(COALESCE(bfs.score, 0)),
    avg(COALESCE(bfs.score, 0)),
    max(COALESCE(bfs.score, 0)),
    min(COALESCE(bfs.score, 0))
  INTO v_all_present, v_sum, v_avg, v_max, v_min
  FROM unnest(_formula_source_field_ids) AS fid
  LEFT JOIN public.broadsheet_field_scores bfs
    ON bfs.field_id = fid
   AND bfs.student_id = _student_id
   AND bfs.subject_id IS NOT DISTINCT FROM _subject_id
   AND bfs.term_id = _term_id;

  v_result := CASE _formula_operation
    WHEN 'sum' THEN v_sum
    WHEN 'average' THEN v_avg
    WHEN 'max' THEN v_max
    WHEN 'min' THEN v_min
  END;

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES
    (_field_id, _student_id, _subject_id, _term_id,
     CASE WHEN v_all_present THEN round(v_result, 2) ELSE NULL END,
     'computed')
  ON CONFLICT (field_id, student_id, subject_id, term_id)
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();
END;
$$;

-- Reuse the same per-combo logic in the existing score-write trigger,
-- so there's one implementation instead of two that can drift apart.
CREATE OR REPLACE FUNCTION public.recompute_computed_broadsheet_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
BEGIN
  FOR dep IN
    SELECT * FROM public.broadsheet_fields
    WHERE is_computed = true
      AND NEW.field_id = ANY(formula_source_field_ids)
  LOOP
    PERFORM public.recompute_one_computed_field(
      dep.id, dep.formula_operation, dep.formula_source_field_ids,
      NEW.student_id, NEW.subject_id, NEW.term_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Fires when a computed field's formula changes: recomputes every
-- (student, subject, term) combo that has an existing score row against
-- ANY of the field's source fields (old or new source set, so a combo
-- that only had data under the previous formula still gets updated —
-- typically to NULL if it no longer has all-present sources).
CREATE OR REPLACE FUNCTION public.recompute_field_after_formula_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field_ids uuid[];
  combo RECORD;
BEGIN
  IF NEW.is_computed IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_field_ids := COALESCE(NEW.formula_source_field_ids, ARRAY[]::uuid[])
    || COALESCE(OLD.formula_source_field_ids, ARRAY[]::uuid[]);

  IF v_field_ids IS NULL OR array_length(v_field_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOR combo IN
    SELECT DISTINCT bfs.student_id, bfs.subject_id, bfs.term_id
    FROM public.broadsheet_field_scores bfs
    WHERE bfs.field_id = ANY(v_field_ids)
  LOOP
    PERFORM public.recompute_one_computed_field(
      NEW.id, NEW.formula_operation, NEW.formula_source_field_ids,
      combo.student_id, combo.subject_id, combo.term_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_field_after_formula_change ON public.broadsheet_fields;
CREATE TRIGGER trg_recompute_field_after_formula_change
  AFTER UPDATE OF formula_operation, formula_source_field_ids ON public.broadsheet_fields
  FOR EACH ROW
  WHEN (NEW.is_computed = true AND (
    NEW.formula_operation IS DISTINCT FROM OLD.formula_operation
    OR NEW.formula_source_field_ids IS DISTINCT FROM OLD.formula_source_field_ids
  ))
  EXECUTE FUNCTION public.recompute_field_after_formula_change();

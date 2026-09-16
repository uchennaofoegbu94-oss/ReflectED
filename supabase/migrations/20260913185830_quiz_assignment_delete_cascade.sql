-- Bug (long-standing, flagged but not started): deleting a quiz or
-- assignment left everything it had already pushed into the pipeline
-- behind — its Pre-CA score, whatever that got auto-pushed into on
-- Broadsheet, any computed field built from those, the Final Total/
-- Average, and the student's Transcript all kept reflecting a source
-- that no longer exists. Scoped to DELETE only (not archive — an
-- archived item is meant to stay counted; only deletion should retract
-- its scores).
--
-- broadsheet_field_scores.source_type/source_id (added by the
-- assignment/quiz push triggers) is exactly the linkage needed:
-- 'quiz'/'assignment' rows at the Pre-CA stage point straight back to
-- quizzes.id/assignments.id, and the row auto-pushed onward from a
-- Pre-CA row carries source_type='pushed', source_id=<pre_ca field_id>
-- (see auto_push_to_next_stage), so the chain can be walked and removed
-- in reverse.

CREATE OR REPLACE FUNCTION public.cascade_remove_pipeline_source(_source_type text, _source_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row RECORD;
  dep RECORD;
  v_student_ids uuid[] := ARRAY[]::uuid[];
  v_term_ids uuid[] := ARRAY[]::uuid[];
  v_school_ids uuid[] := ARRAY[]::uuid[];
  i integer;
  v_class_id uuid;
BEGIN
  -- Capture which (student, term, school) combos are affected BEFORE
  -- deleting anything, since the rows won't be queryable afterward.
  FOR row IN
    SELECT DISTINCT student_id, term_id, school_id
    FROM public.broadsheet_field_scores
    WHERE source_type = _source_type AND source_id = _source_id
  LOOP
    v_student_ids := array_append(v_student_ids, row.student_id);
    v_term_ids := array_append(v_term_ids, row.term_id);
    v_school_ids := array_append(v_school_ids, row.school_id);
  END LOOP;

  FOR row IN
    SELECT * FROM public.broadsheet_field_scores
    WHERE source_type = _source_type AND source_id = _source_id
  LOOP
    -- Remove the pushed Broadsheet-stage copy of this Pre-CA row, if any.
    DELETE FROM public.broadsheet_field_scores bfs
    USING public.broadsheet_fields bf
    WHERE bf.id = row.field_id
      AND bfs.field_id = bf.push_target_field_id
      AND bfs.student_id = row.student_id
      AND bfs.subject_id IS NOT DISTINCT FROM row.subject_id
      AND bfs.term_id = row.term_id
      AND bfs.source_type = 'pushed'
      AND bfs.source_id = row.field_id;

    -- Recompute any computed field (at either stage) built from this
    -- field, now that one of its source scores is gone.
    FOR dep IN
      SELECT * FROM public.broadsheet_fields
      WHERE is_computed = true AND row.field_id = ANY(formula_source_field_ids)
    LOOP
      PERFORM public.recompute_one_computed_field(
        dep.id, dep.formula_operation, dep.formula_source_field_ids,
        row.student_id, row.subject_id, row.term_id
      );
    END LOOP;

    DELETE FROM public.broadsheet_field_scores WHERE id = row.id;
  END LOOP;

  -- Final Total/Average, then Transcript (whole-class, per its own
  -- signature) for every affected student+term captured above.
  FOR i IN 1 .. COALESCE(array_length(v_student_ids, 1), 0) LOOP
    PERFORM public.recompute_final_totals_for(v_student_ids[i], v_term_ids[i], v_school_ids[i]);

    SELECT class_id INTO v_class_id FROM public.students WHERE id = v_student_ids[i];
    IF v_class_id IS NOT NULL THEN
      PERFORM public.recompute_class_transcripts(v_class_id, v_term_ids[i]);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.cascade_delete_quiz_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted IS TRUE AND COALESCE(OLD.is_deleted, false) IS DISTINCT FROM true THEN
    PERFORM public.cascade_remove_pipeline_source('quiz', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_quiz_scores ON public.quizzes;
CREATE TRIGGER trg_cascade_delete_quiz_scores
  AFTER UPDATE OF is_deleted ON public.quizzes
  FOR EACH ROW
  WHEN (NEW.is_deleted = true)
  EXECUTE FUNCTION public.cascade_delete_quiz_scores();

CREATE OR REPLACE FUNCTION public.cascade_delete_assignment_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted IS TRUE AND COALESCE(OLD.is_deleted, false) IS DISTINCT FROM true THEN
    PERFORM public.cascade_remove_pipeline_source('assignment', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_assignment_scores ON public.assignments;
CREATE TRIGGER trg_cascade_delete_assignment_scores
  AFTER UPDATE OF is_deleted ON public.assignments
  FOR EACH ROW
  WHEN (NEW.is_deleted = true)
  EXECUTE FUNCTION public.cascade_delete_assignment_scores();

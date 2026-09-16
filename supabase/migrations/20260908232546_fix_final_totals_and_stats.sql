-- Bug: recompute_final_totals_for (Broadsheet's Final Total/Average)
-- summed EVERY broadsheet+subject-scope field's score per subject —
-- including both the raw fields (CA1/CA2/Exam) AND any computed field
-- built from them (e.g. a "Total" = CA1+CA2+Exam column), so a
-- subject's contribution was counted roughly twice. Reported as Final
-- Total/Average showing values around 2x what they should be.
--
-- Fix: sum only the single field a school has designated as its
-- is_grade_source field per subject (the same source of truth Report
-- Card's Grade badge and Transcript already use) — one number per
-- subject, no double-counting by construction. For schools that
-- haven't designated a grade-source field yet, fall back to summing
-- only NON-computed fields per subject (still legacy-compatible, but
-- no longer double-counts a computed rollup alongside its own inputs).

CREATE OR REPLACE FUNCTION public.recompute_final_totals_for(_student_id uuid, _term_id uuid, _school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_field_id uuid;
  v_avg_field_id uuid;
  v_grade_source_field_id uuid;
  v_count integer;
  v_sum numeric;
  v_avg numeric;
BEGIN
  SELECT id INTO v_total_field_id FROM public.broadsheet_fields
    WHERE school_id = _school_id AND computation_key = 'final_total';
  SELECT id INTO v_avg_field_id FROM public.broadsheet_fields
    WHERE school_id = _school_id AND computation_key = 'final_average';

  IF v_total_field_id IS NULL OR v_avg_field_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_grade_source_field_id FROM public.broadsheet_fields
    WHERE school_id = _school_id AND pipeline_stage = 'broadsheet' AND is_grade_source = true
    LIMIT 1;

  IF v_grade_source_field_id IS NOT NULL THEN
    -- One value per subject (the grade-source field's own score) —
    -- can't double-count since there's exactly one row per subject.
    SELECT COUNT(DISTINCT bfs.subject_id), COALESCE(SUM(bfs.score), 0)
      INTO v_count, v_sum
    FROM public.broadsheet_field_scores bfs
    WHERE bfs.field_id = v_grade_source_field_id
      AND bfs.student_id = _student_id
      AND bfs.term_id = _term_id
      AND bfs.score IS NOT NULL;
  ELSE
    -- No grade-source field designated: fall back to summing only
    -- non-computed subject-scope fields per subject, so a computed
    -- rollup of those same fields is never added on top of them.
    SELECT COUNT(DISTINCT bfs.subject_id), COALESCE(SUM(bfs.score), 0)
      INTO v_count, v_sum
    FROM public.broadsheet_field_scores bfs
    JOIN public.broadsheet_fields bf ON bf.id = bfs.field_id
    WHERE bf.school_id = _school_id
      AND bf.pipeline_stage = 'broadsheet'
      AND bf.field_scope = 'subject'
      AND bf.is_computed = false
      AND bfs.student_id = _student_id
      AND bfs.term_id = _term_id
      AND bfs.score IS NOT NULL;
  END IF;

  v_avg := CASE WHEN v_count > 0 THEN round(v_sum / v_count, 2) ELSE NULL END;

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES
    (v_total_field_id, _student_id, NULL, _term_id,
     CASE WHEN v_count > 0 THEN v_sum ELSE NULL END, 'system_final')
  ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES
    (v_avg_field_id, _student_id, NULL, _term_id, v_avg, 'system_final')
  ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();
END;
$$;

-- One-time retroactive fix: recompute Final Total/Average for every
-- student+term that currently has ANY broadsheet subject-scope score,
-- using the corrected logic above, so existing (inflated) data is
-- corrected immediately rather than waiting on the next score edit.
DO $$
DECLARE
  combo RECORD;
BEGIN
  FOR combo IN
    SELECT DISTINCT bfs.student_id, bfs.term_id, bf.school_id
    FROM public.broadsheet_field_scores bfs
    JOIN public.broadsheet_fields bf ON bf.id = bfs.field_id
    WHERE bf.pipeline_stage = 'broadsheet' AND bf.field_scope = 'subject'
  LOOP
    PERFORM public.recompute_final_totals_for(combo.student_id, combo.term_id, combo.school_id);
  END LOOP;
END $$;

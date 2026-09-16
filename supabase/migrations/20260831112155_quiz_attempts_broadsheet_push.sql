-- CRITICAL FIX: quiz grading has never actually reached broadsheet_field_scores.
-- propagate_submission_to_broadsheet() (20260603064510) only fires on
-- public.submissions — but quizzes are graded entirely through
-- public.quiz_attempts (auto-graded on submit for MCQ/true-false via
-- useSubmitQuiz, or via useGradeQuizAnswer for essays). Neither path ever
-- writes to submissions, so a quiz's broadsheet_field_id was always
-- inert — the push mechanism worked for assignments only. This adds the
-- missing equivalent trigger on quiz_attempts, mirroring the same scaling/
-- upsert logic exactly.

CREATE OR REPLACE FUNCTION public.propagate_quiz_attempt_to_broadsheet()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_field_id uuid;
  v_max_points numeric;
  v_source_total numeric;
  v_term_id uuid;
  v_subject_id uuid;
  v_scaled numeric;
BEGIN
  IF NEW.is_graded IS NOT TRUE OR NEW.total_score IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT q.broadsheet_field_id, COALESCE(q.total_marks, q.total_points, 100), c.subject_id
    INTO v_field_id, v_source_total, v_subject_id
  FROM public.quizzes q
  LEFT JOIN public.classrooms c ON c.id = q.classroom_id
  WHERE q.id = NEW.quiz_id;

  IF v_field_id IS NULL OR v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT max_points INTO v_max_points FROM public.broadsheet_fields WHERE id = v_field_id;
  IF v_max_points IS NULL OR v_source_total IS NULL OR v_source_total = 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_term_id FROM public.terms WHERE is_active = true LIMIT 1;
  IF v_term_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_scaled := LEAST(ROUND((NEW.total_score::numeric / v_source_total) * v_max_points, 2), v_max_points);

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type, source_id, entered_by)
  VALUES
    (v_field_id, NEW.student_id, v_subject_id, v_term_id, v_scaled, 'quiz', NEW.quiz_id, NEW.graded_by)
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

DROP TRIGGER IF EXISTS trg_propagate_quiz_attempt_to_broadsheet ON public.quiz_attempts;
CREATE TRIGGER trg_propagate_quiz_attempt_to_broadsheet
AFTER INSERT OR UPDATE OF is_graded, total_score ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.propagate_quiz_attempt_to_broadsheet();

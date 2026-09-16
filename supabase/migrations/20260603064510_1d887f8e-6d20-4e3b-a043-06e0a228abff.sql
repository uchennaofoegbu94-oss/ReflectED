
-- Phase 5: Auto-propagation, recompute, and field selector schema

-- 1. Per-field max points on broadsheet_fields
ALTER TABLE public.broadsheet_fields
  ADD COLUMN IF NOT EXISTS max_points numeric NOT NULL DEFAULT 100;

-- 2. Assignment / Quiz target field (chosen at creation time)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS broadsheet_field_id uuid REFERENCES public.broadsheet_fields(id) ON DELETE SET NULL;

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS broadsheet_field_id uuid REFERENCES public.broadsheet_fields(id) ON DELETE SET NULL;

-- 3. Ensure broadsheet_field_scores has unique key (used for upsert)
CREATE UNIQUE INDEX IF NOT EXISTS broadsheet_field_scores_unique_idx
  ON public.broadsheet_field_scores (field_id, student_id, subject_id, term_id);

-- 4. School-aware grade calculator using grading_scales
CREATE OR REPLACE FUNCTION public.compute_grade_for_school(_school_id uuid, _score numeric)
RETURNS TABLE(grade text, remark text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT gs.grade, gs.remark
  FROM public.grading_scales gs
  WHERE gs.school_id = _school_id
    AND _score >= gs.min_score
    AND _score <= gs.max_score
  ORDER BY gs.max_score DESC
  LIMIT 1;
$$;

-- 5. Auto-recompute total/grade/remarks on assessment_scores
CREATE OR REPLACE FUNCTION public.recompute_assessment_score()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_school uuid;
  v_grade text;
  v_remark text;
BEGIN
  v_total := COALESCE(NEW.ca1,0) + COALESCE(NEW.ca2,0) + COALESCE(NEW.ca3,0) + COALESCE(NEW.exam,0);
  NEW.total := v_total;

  SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;

  SELECT g.grade, g.remark INTO v_grade, v_remark
  FROM public.compute_grade_for_school(v_school, v_total) g;

  IF v_grade IS NOT NULL THEN
    NEW.grade := v_grade;
    NEW.remarks := v_remark;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_assessment_score ON public.assessment_scores;
CREATE TRIGGER trg_recompute_assessment_score
BEFORE INSERT OR UPDATE OF ca1, ca2, ca3, exam ON public.assessment_scores
FOR EACH ROW EXECUTE FUNCTION public.recompute_assessment_score();

-- 6. Auto-propagate graded submissions into broadsheet_field_scores
CREATE OR REPLACE FUNCTION public.propagate_submission_to_broadsheet()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_field_id uuid;
  v_max_points numeric;
  v_source_total numeric;
  v_term_id uuid;
  v_subject_id uuid;
  v_source_type text;
  v_source_id uuid;
  v_scaled numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'graded' OR NEW.grade IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.assignment_id IS NOT NULL THEN
    SELECT a.broadsheet_field_id, COALESCE(a.total_marks, a.points, 100), c.subject_id
      INTO v_field_id, v_source_total, v_subject_id
    FROM public.assignments a
    LEFT JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE a.id = NEW.assignment_id;
    v_source_type := 'assignment';
    v_source_id := NEW.assignment_id;
  ELSIF NEW.quiz_id IS NOT NULL THEN
    SELECT q.broadsheet_field_id, COALESCE(q.total_marks, q.total_points, 100), c.subject_id
      INTO v_field_id, v_source_total, v_subject_id
    FROM public.quizzes q
    LEFT JOIN public.classrooms c ON c.id = q.classroom_id
    WHERE q.id = NEW.quiz_id;
    v_source_type := 'quiz';
    v_source_id := NEW.quiz_id;
  ELSE
    RETURN NEW;
  END IF;

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

  v_scaled := LEAST(ROUND((NEW.grade::numeric / v_source_total) * v_max_points, 2), v_max_points);

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type, source_id, entered_by)
  VALUES
    (v_field_id, NEW.student_id, v_subject_id, v_term_id, v_scaled, v_source_type, v_source_id, NEW.graded_by)
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

DROP TRIGGER IF EXISTS trg_propagate_submission_to_broadsheet ON public.submissions;
CREATE TRIGGER trg_propagate_submission_to_broadsheet
AFTER INSERT OR UPDATE OF status, grade ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.propagate_submission_to_broadsheet();

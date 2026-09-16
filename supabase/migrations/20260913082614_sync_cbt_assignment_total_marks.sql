-- Follow-up to quiz_total_points_auto_aggregate: that migration keeps
-- quizzes.total_points/total_marks in sync with SUM(quiz_questions.points),
-- which is what the quiz_attempts->Broadsheet push scaling actually reads
-- (recompute_final_totals_for and the push trigger both use the quiz's own
-- total, not the assignment's) — so scoring itself was already correct.
--
-- But a CBT assignment (quizzes.assignment_id) also has its OWN
-- total_marks column on the assignments table, used for display —
-- e.g. AssignmentGradingDialog shows "score / assignment.total_marks".
-- That column was never touched by the quiz-side recompute, so editing
-- a CBT assignment's questions after creation left this display value
-- stale even though the underlying score/push math was already right.

CREATE OR REPLACE FUNCTION public.recompute_quiz_total_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz_id uuid;
  v_count integer;
  v_sum numeric;
  v_assignment_id uuid;
BEGIN
  v_quiz_id := COALESCE(NEW.quiz_id, OLD.quiz_id);

  SELECT COUNT(*), COALESCE(SUM(points), 0) INTO v_count, v_sum
  FROM public.quiz_questions
  WHERE quiz_id = v_quiz_id;

  -- Only auto-aggregate once the quiz actually has question rows (CBT
  -- quizzes with a question builder). A typed/upload quiz with no
  -- question rows keeps whatever total_points/total_marks was set at
  -- creation time instead of being zeroed out by this trigger.
  IF v_count > 0 THEN
    UPDATE public.quizzes
    SET total_points = v_sum, total_marks = v_sum
    WHERE id = v_quiz_id
    RETURNING assignment_id INTO v_assignment_id;

    -- CBT assignment: keep the assignment's own display total_marks in
    -- sync with the same number, so grading views don't show a stale
    -- denominator after the questions change.
    IF v_assignment_id IS NOT NULL THEN
      UPDATE public.assignments
      SET total_marks = v_sum
      WHERE id = v_assignment_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- One-time backfill for any CBT assignment whose total_marks is already
-- out of sync with its linked quiz's current question-point sum.
UPDATE public.assignments a
SET total_marks = sub.total
FROM (
  SELECT q.assignment_id, SUM(qq.points) AS total
  FROM public.quiz_questions qq
  JOIN public.quizzes q ON q.id = qq.quiz_id
  WHERE q.assignment_id IS NOT NULL
  GROUP BY q.assignment_id
) sub
WHERE a.id = sub.assignment_id
  AND a.total_marks IS DISTINCT FROM sub.total;

-- Bug: quizzes.total_points/total_marks are stored columns set once at
-- creation time (Create Quiz already sums question points correctly on
-- create) but never recomputed afterwards — editing a question's points,
-- or adding/deleting a question on an existing quiz, left the stored
-- total stale (reported: "51 Total Marks" showing after editing down to
-- a single 50-point question). Several different client paths write to
-- quiz_questions (useAddQuizQuestion, useUpdateQuizQuestion,
-- useDeleteQuizQuestion, useAddQuizQuestions' bulk insert), so a DB
-- trigger keyed on quiz_id is the one place that reliably catches all
-- of them instead of duplicating a recompute call in every mutation.

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
    WHERE id = v_quiz_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_quiz_total_points ON public.quiz_questions;
CREATE TRIGGER trg_recompute_quiz_total_points
  AFTER INSERT OR UPDATE OF points OR DELETE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.recompute_quiz_total_points();

-- One-time backfill: fix any existing quiz whose stored total_points/
-- total_marks is already out of sync with the sum of its current
-- question points, so the fix applies immediately rather than waiting
-- for the next question edit on each affected quiz.
UPDATE public.quizzes q
SET total_points = sub.total, total_marks = sub.total
FROM (
  SELECT quiz_id, SUM(points) AS total
  FROM public.quiz_questions
  GROUP BY quiz_id
) sub
WHERE q.id = sub.quiz_id
  AND (q.total_points IS DISTINCT FROM sub.total OR q.total_marks IS DISTINCT FROM sub.total);

-- CBT assignment engine: content_type='cbt' was a selectable option on
-- assignments (added in an earlier round) with no actual question-
-- building behind it. Rather than building a parallel question-storage
-- system, a CBT assignment's questions live in a real quiz row (reusing
-- quiz_questions, quiz_attempts, and everything already built for
-- quizzes — including this session's quiz_attempts -> broadsheet push
-- fix) that this new column links back to its assignment.
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_quizzes_assignment_id ON public.quizzes(assignment_id);

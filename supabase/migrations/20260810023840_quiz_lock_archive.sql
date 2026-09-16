-- #2 (lock/unlock) + #4 (archive) for quizzes
--
-- is_deleted already existed on quizzes (added 20260205063247) for exactly
-- the archive use case #4 asks for, but nothing ever set it (no UI) and —
-- worth fixing in the same pass — the student-facing SELECT policy never
-- actually checked it, only is_active. A client-side filter alone isn't a
-- real guarantee here, so this adds it to RLS directly.
--
-- is_locked is new: a manual visibility override a teacher can flip
-- independent of is_active/scheduled_at (the schedule module), per #2's
-- explicit "this is apart from the schedule module".
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Students view active quizzes" ON public.quizzes;
CREATE POLICY "Students view active unlocked quizzes"
ON public.quizzes FOR SELECT
USING (
  is_active = true
  AND is_locked = false
  AND is_deleted = false
  AND EXISTS (
    SELECT 1 FROM classroom_members cm
    JOIN students s ON cm.student_id = s.id
    WHERE cm.classroom_id = quizzes.classroom_id AND s.user_id = auth.uid()
  )
);

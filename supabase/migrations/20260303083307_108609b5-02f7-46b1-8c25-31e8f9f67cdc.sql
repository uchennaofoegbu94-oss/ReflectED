
-- Allow students to insert themselves into classroom_members (join a classroom)
CREATE POLICY "Students join classrooms"
ON public.classroom_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = classroom_members.student_id
    AND s.user_id = auth.uid()
  )
);

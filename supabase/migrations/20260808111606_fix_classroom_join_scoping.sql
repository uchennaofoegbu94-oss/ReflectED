-- Fix #18: a student could join any classroom by code before ever being
-- enrolled in a class, and could join classrooms belonging to a different
-- class entirely.
--
-- The original "Students join classrooms" policy (20260303083307) only
-- checked that classroom_members.student_id resolved to the caller's own
-- student record — it never checked students.class_id was even set, and
-- never checked the classroom's own class_id matched it. Classrooms are
-- class-specified (classrooms.class_id), so a student should only ever be
-- able to join a classroom that belongs to the class they're actually
-- enrolled in.
DROP POLICY IF EXISTS "Students join classrooms" ON public.classroom_members;
CREATE POLICY "Students join their own class's classrooms"
ON public.classroom_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.classrooms c ON c.id = classroom_members.classroom_id
    WHERE s.id = classroom_members.student_id
      AND s.user_id = auth.uid()
      AND s.class_id IS NOT NULL
      AND c.class_id = s.class_id
  )
);

-- find_classroom_by_code needs to also return class_id so the client can
-- give a clear "this classroom isn't for your class" message up front,
-- instead of a raw RLS error surfacing from the insert above.
--
-- Postgres won't let CREATE OR REPLACE change a function's RETURNS TABLE
-- signature (adding the class_id column counts as a signature change), so
-- the old version has to be dropped first.
DROP FUNCTION IF EXISTS public.find_classroom_by_code(text);
CREATE OR REPLACE FUNCTION public.find_classroom_by_code(_code text)
RETURNS TABLE(id uuid, name text, school_id uuid, class_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.school_id, c.class_id
  FROM public.classrooms c
  WHERE c.code = _code
  AND c.is_archived = false
  LIMIT 1;
$function$;

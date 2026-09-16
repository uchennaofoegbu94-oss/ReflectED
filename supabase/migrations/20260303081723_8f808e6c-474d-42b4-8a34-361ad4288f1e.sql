
-- Step 1: Create security definer helper to check if current user is a member of a classroom
-- This breaks the circular RLS dependency between classrooms and classroom_members
CREATE OR REPLACE FUNCTION public.is_classroom_member(_classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_members cm
    JOIN public.students s ON cm.student_id = s.id
    WHERE cm.classroom_id = _classroom_id 
    AND s.user_id = auth.uid()
  )
$$;

-- Step 2: Drop and recreate the classrooms SELECT policy using the helper function
DROP POLICY IF EXISTS "Classrooms viewable by authenticated" ON public.classrooms;
CREATE POLICY "Classrooms viewable by authenticated"
ON public.classrooms
FOR SELECT
USING (
  is_archived = false 
  AND (
    is_classroom_owner(id) 
    OR is_classroom_co_teacher(id) 
    OR is_staff(auth.uid())
    OR is_classroom_member(id)
  )
);

-- Step 3: Drop and recreate the classroom_members SELECT policy using helper functions (no back-reference to classrooms)
DROP POLICY IF EXISTS "View classroom members" ON public.classroom_members;
CREATE POLICY "View classroom members"
ON public.classroom_members
FOR SELECT
USING (
  is_staff(auth.uid())
  OR is_classroom_owner(classroom_id)
  OR is_classroom_co_teacher(classroom_id)
  OR is_classroom_member(classroom_id)
);

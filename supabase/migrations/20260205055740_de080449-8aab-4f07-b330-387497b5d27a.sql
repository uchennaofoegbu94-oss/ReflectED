-- Fix infinite recursion in classroom policies by using simpler, non-recursive policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Teachers view own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers manage own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Students view enrolled classrooms" ON public.classrooms;

-- Create simple, non-recursive SELECT policy for classrooms
-- Staff (authenticated users with staff record) can see all non-archived classrooms
-- Students can see classrooms they're enrolled in
CREATE POLICY "Classrooms viewable by authenticated" 
ON public.classrooms FOR SELECT 
TO authenticated 
USING (
  is_archived = false 
  AND (
    -- User is the classroom teacher
    is_classroom_owner(id)
    -- OR user is a co-teacher
    OR is_classroom_co_teacher(id)
    -- OR user is staff (admin/principal/teacher/accountant)
    OR (SELECT EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()))
    -- OR user is a student enrolled in this classroom
    OR (SELECT EXISTS (
      SELECT 1 FROM public.classroom_members cm 
      JOIN public.students s ON cm.student_id = s.id 
      WHERE cm.classroom_id = classrooms.id AND s.user_id = auth.uid()
    ))
  )
);

-- Teachers can insert their own classrooms
CREATE POLICY "Teachers insert own classrooms" 
ON public.classrooms FOR INSERT 
TO authenticated 
WITH CHECK (
  teacher_id = (SELECT id FROM public.staff WHERE user_id = auth.uid() LIMIT 1)
);

-- Teachers can update their own classrooms, admins/principals can update any
CREATE POLICY "Teachers update own classrooms" 
ON public.classrooms FOR UPDATE 
TO authenticated 
USING (
  is_classroom_owner(id)
  OR (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'principal')))
)
WITH CHECK (
  is_classroom_owner(id)
  OR (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'principal')))
);

-- Teachers can delete (archive) their own classrooms
CREATE POLICY "Teachers delete own classrooms" 
ON public.classrooms FOR DELETE 
TO authenticated 
USING (
  is_classroom_owner(id)
  OR (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'principal')))
);
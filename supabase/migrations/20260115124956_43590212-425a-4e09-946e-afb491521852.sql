-- Create a helper function to check if the current user owns a classroom
CREATE OR REPLACE FUNCTION public.is_classroom_owner(_classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classrooms c
    JOIN public.staff s ON c.teacher_id = s.id
    WHERE c.id = _classroom_id 
    AND s.user_id = auth.uid()
  )
$$;

-- Create a helper function to check if user is a co-teacher of a classroom
CREATE OR REPLACE FUNCTION public.is_classroom_co_teacher(_classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classroom_co_teachers ct
    JOIN public.staff s ON ct.teacher_id = s.id
    WHERE ct.classroom_id = _classroom_id 
    AND s.user_id = auth.uid()
  )
$$;

-- Create function to get staff ID for current user
CREATE OR REPLACE FUNCTION public.get_my_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.staff WHERE user_id = auth.uid() LIMIT 1
$$;

-- Drop existing problematic policies on classrooms
DROP POLICY IF EXISTS "Teachers manage own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Teachers view own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Students view enrolled classrooms" ON public.classrooms;

-- Create new policies using the helper functions
CREATE POLICY "Teachers manage own classrooms" 
ON public.classrooms 
FOR ALL 
USING (
  (EXISTS (
    SELECT 1 FROM public.staff s 
    WHERE s.id = classrooms.teacher_id 
    AND s.user_id = auth.uid()
  )) 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'principal'::app_role)
);

CREATE POLICY "Teachers view own classrooms" 
ON public.classrooms 
FOR SELECT 
USING (
  (EXISTS (
    SELECT 1 FROM public.staff s 
    WHERE s.id = classrooms.teacher_id 
    AND s.user_id = auth.uid()
  )) 
  OR is_staff(auth.uid())
);

CREATE POLICY "Students view enrolled classrooms" 
ON public.classrooms 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.classroom_members cm
    JOIN public.students s ON cm.student_id = s.id
    WHERE cm.classroom_id = classrooms.id 
    AND s.user_id = auth.uid()
  )
);

-- Also fix classroom_co_teachers policies that may have similar issues
DROP POLICY IF EXISTS "Teachers manage co-teachers" ON public.classroom_co_teachers;
DROP POLICY IF EXISTS "View co-teachers" ON public.classroom_co_teachers;

CREATE POLICY "Teachers manage co-teachers" 
ON public.classroom_co_teachers 
FOR ALL 
USING (
  public.is_classroom_owner(classroom_id) 
  OR is_staff(auth.uid())
);

CREATE POLICY "View co-teachers" 
ON public.classroom_co_teachers 
FOR SELECT 
USING (
  public.is_classroom_owner(classroom_id) 
  OR public.is_classroom_co_teacher(classroom_id)
  OR (EXISTS (
    SELECT 1 FROM public.classroom_members cm
    JOIN public.students s ON cm.student_id = s.id
    WHERE cm.classroom_id = classroom_co_teachers.classroom_id 
    AND s.user_id = auth.uid()
  )) 
  OR is_staff(auth.uid())
);
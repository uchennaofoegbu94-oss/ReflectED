
-- Step 1: Create missing staff record for the orphan classroom teacher
INSERT INTO public.staff (user_id, employee_id, first_name, last_name, email, gender, employment_status)
VALUES ('a6303bf3-8b70-4b38-99fe-72183745ea13', 'EMP-SIVAN', 'Mr. Sivan', '', 'sivan@mirrorintschool.com', 'male', 'active');

-- Step 2: Drop old FK
ALTER TABLE public.classrooms DROP CONSTRAINT IF EXISTS classrooms_teacher_id_fkey;

-- Step 3: Convert ALL teacher_id values from auth user IDs to staff IDs
UPDATE public.classrooms c
SET teacher_id = s.id
FROM public.staff s
WHERE c.teacher_id::text = s.user_id::text;

-- Step 4: Add new FK to staff(id)
ALTER TABLE public.classrooms ADD CONSTRAINT classrooms_teacher_id_fkey 
  FOREIGN KEY (teacher_id) REFERENCES public.staff(id) ON DELETE SET NULL;

-- Step 5: Fix all RLS policies that used c.teacher_id = auth.uid()

DROP POLICY IF EXISTS "View assignments" ON public.assignments;
CREATE POLICY "View assignments" ON public.assignments FOR SELECT
USING (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id));

DROP POLICY IF EXISTS "Teachers create posts" ON public.stream_posts;
CREATE POLICY "Teachers create posts" ON public.stream_posts FOR INSERT
WITH CHECK (is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid()));

DROP POLICY IF EXISTS "View stream posts" ON public.stream_posts;
CREATE POLICY "View stream posts" ON public.stream_posts FOR SELECT
USING (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id));

DROP POLICY IF EXISTS "Teachers manage live sessions" ON public.live_class_sessions;
CREATE POLICY "Teachers manage live sessions" ON public.live_class_sessions FOR ALL
USING (is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid()));

DROP POLICY IF EXISTS "View live sessions" ON public.live_class_sessions;
CREATE POLICY "View live sessions" ON public.live_class_sessions FOR SELECT
USING (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id));

DROP POLICY IF EXISTS "Teachers manage syllabus" ON public.classroom_syllabus;
CREATE POLICY "Teachers manage syllabus" ON public.classroom_syllabus FOR ALL
USING (is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid()));

DROP POLICY IF EXISTS "View syllabus" ON public.classroom_syllabus;
CREATE POLICY "View syllabus" ON public.classroom_syllabus FOR SELECT
USING (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id));

DROP POLICY IF EXISTS "Teachers grade submissions" ON public.submissions;
CREATE POLICY "Teachers grade submissions" ON public.submissions FOR UPDATE
USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Teachers view submissions" ON public.submissions;
CREATE POLICY "Teachers view submissions" ON public.submissions FOR SELECT
USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "View co-teachers" ON public.classroom_co_teachers;
CREATE POLICY "View co-teachers" ON public.classroom_co_teachers FOR SELECT
USING (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id));

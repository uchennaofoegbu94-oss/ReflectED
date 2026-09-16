
-- ========================================
-- Task 2: Role definitions table for dynamic CRUD
-- ========================================
CREATE TABLE public.role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL CHECK (category IN ('staff', 'student')),
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid DEFAULT NULL
);

ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view role definitions"
ON public.role_definitions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage role definitions"
ON public.role_definitions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

-- Seed with existing system roles
INSERT INTO public.role_definitions (key, label, category, is_system) VALUES
  ('form_teacher', 'Form Teacher', 'staff', true),
  ('games_master', 'Games Master', 'staff', true),
  ('dean_of_studies', 'Dean of Studies', 'staff', true),
  ('head_of_department', 'Head of Department', 'staff', true),
  ('exam_officer', 'Exam Officer', 'staff', true),
  ('guidance_counselor', 'Guidance Counselor', 'staff', true),
  ('librarian', 'Librarian', 'staff', true),
  ('ict_coordinator', 'ICT Coordinator', 'staff', true),
  ('vice_principal', 'Vice-Principal', 'staff', true),
  ('duty_marshall', 'Duty Marshall', 'staff', true),
  ('music_social_coordinator', 'Music/Social Events Coordinator', 'staff', true),
  ('head_prefect', 'Head Prefect', 'student', true),
  ('assistant_head_prefect', 'Asst. Head Prefect', 'student', true),
  ('class_prefect', 'Class Prefect', 'student', true),
  ('sports_prefect', 'Sports Prefect', 'student', true),
  ('library_prefect', 'Library Prefect', 'student', true),
  ('health_prefect', 'Health Prefect', 'student', true),
  ('social_prefect', 'Social Prefect', 'student', true),
  ('labour_prefect', 'Labour Prefect', 'student', true),
  ('utilities_prefect', 'Utilities/Special Rooms Prefect', 'student', true),
  ('regulator', 'Regulator', 'student', true),
  ('assistant_regulator', 'Asst. Regulator', 'student', true),
  ('senior_prefect', 'Senior Prefect', 'student', true),
  ('deputy_senior_prefect', 'Deputy Senior Prefect', 'student', true),
  ('teacher_assistant', 'Teacher Assistant', 'student', true),
  ('drum_major', 'Drum Major', 'student', true),
  ('laboratories_prefect', 'Laboratories Prefect', 'student', true);

-- Add custom_role_name to special_roles for non-enum custom roles
ALTER TABLE public.special_roles ADD COLUMN IF NOT EXISTS custom_role_name text DEFAULT NULL;

-- ========================================
-- Task 1: Function for parent to link child by admission number
-- ========================================
CREATE OR REPLACE FUNCTION public.link_child_to_parent(p_admission_number text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
BEGIN
  -- Find student by admission number
  SELECT id INTO v_student_id
  FROM public.students
  WHERE admission_number = p_admission_number
    AND (parent_id IS NULL OR parent_id = auth.uid());

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student not found or already linked to another parent';
  END IF;

  -- Link the student to this parent
  UPDATE public.students
  SET parent_id = auth.uid()
  WHERE id = v_student_id;

  RETURN v_student_id;
END;
$$;

-- Allow parents to unlink their own children
CREATE OR REPLACE FUNCTION public.unlink_child_from_parent(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.students
  SET parent_id = NULL
  WHERE id = p_student_id AND parent_id = auth.uid();
END;
$$;

-- ========================================
-- Task 4: Classroom materials table
-- ========================================
CREATE TABLE public.classroom_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT NULL,
  file_url text DEFAULT NULL,
  file_name text DEFAULT NULL,
  file_type text DEFAULT NULL,
  file_size bigint DEFAULT NULL,
  link_url text DEFAULT NULL,
  topic text DEFAULT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage materials"
ON public.classroom_materials FOR ALL TO authenticated
USING (is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid()))
WITH CHECK (is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid()));

CREATE POLICY "View classroom materials"
ON public.classroom_materials FOR SELECT TO authenticated
USING (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id));

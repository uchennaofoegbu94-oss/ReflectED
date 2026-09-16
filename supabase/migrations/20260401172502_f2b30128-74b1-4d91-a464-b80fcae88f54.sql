
-- 1. Create schools table
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  school_code text NOT NULL UNIQUE,
  logo_url text,
  address text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 2. Create super_admins table
CREATE TABLE public.super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- 3. Add school_id to profiles FIRST (needed by helper functions)
ALTER TABLE public.profiles ADD COLUMN school_id uuid REFERENCES public.schools(id);

-- 4. Helper functions
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT school_id FROM public.profiles WHERE user_id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.same_school(_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_super_admin(auth.uid()) OR (_school_id IS NOT NULL AND _school_id = public.get_user_school_id(auth.uid())) $$;

CREATE OR REPLACE FUNCTION public.find_school_by_code(_code text)
RETURNS TABLE(id uuid, name text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT s.id, s.name, s.logo_url FROM public.schools s WHERE upper(s.school_code) = upper(_code) AND s.is_active = true LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.promote_to_super_admin(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.super_admins) OR public.is_super_admin(auth.uid()) THEN
    INSERT INTO public.super_admins (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  ELSE RAISE EXCEPTION 'Only super admins can promote users';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_school_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.find_school_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_super_admin(uuid) TO authenticated;

-- 5. RLS on new tables
CREATE POLICY "Super admins manage schools" ON public.schools FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Users view own school" ON public.schools FOR SELECT TO authenticated
  USING (id = public.get_user_school_id(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins manage" ON public.super_admins FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Check own super admin status" ON public.super_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6. Add school_id to ALL other tables
DO $$ DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'students','staff','user_roles','academic_sessions','terms',
    'class_arms','subjects','class_subjects','classrooms','classroom_members',
    'classroom_materials','classroom_syllabus','classroom_co_teachers',
    'assignments','submissions','quizzes','quiz_questions','quiz_attempts',
    'quiz_answers','attendance_records','attendance_parameters','fee_structures',
    'payments','school_expenses','events','event_participants','event_supporters',
    'messages','message_recipients','notifications','assignment_notifications',
    'parent_notifications','assessment_scores','assessment_scores_tracker',
    'broadsheet_fields','broadsheet_field_scores','grading_scales','grading_rubrics',
    'result_transcripts','special_roles','role_definitions','school_settings',
    'live_class_sessions','stream_posts','post_comments','attachments','audit_log',
    'timetable_slots','staff_clock_records'
  ]) LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name='school_id') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN school_id uuid REFERENCES public.schools(id)', tbl);
    END IF;
  END LOOP;
END $$;

-- 7. Default school + data migration
INSERT INTO public.schools (id, name, school_code)
VALUES ('00000000-0000-0000-0000-000000000001', 'ReflectED Academy', 'REFLECTED')
ON CONFLICT (id) DO NOTHING;

DO $$ DECLARE sid uuid := '00000000-0000-0000-0000-000000000001'; tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'profiles','students','staff','user_roles','academic_sessions','terms',
    'class_arms','subjects','class_subjects','classrooms','classroom_members',
    'classroom_materials','classroom_syllabus','classroom_co_teachers',
    'assignments','submissions','quizzes','quiz_questions','quiz_attempts',
    'quiz_answers','attendance_records','attendance_parameters','fee_structures',
    'payments','school_expenses','events','event_participants','event_supporters',
    'messages','message_recipients','notifications','assignment_notifications',
    'parent_notifications','assessment_scores','assessment_scores_tracker',
    'broadsheet_fields','broadsheet_field_scores','grading_scales','grading_rubrics',
    'result_transcripts','special_roles','role_definitions','school_settings',
    'live_class_sessions','stream_posts','post_comments','attachments','audit_log',
    'timetable_slots','staff_clock_records'
  ]) LOOP
    EXECUTE format('UPDATE public.%I SET school_id = %L WHERE school_id IS NULL', tbl, sid);
  END LOOP;
END $$;

-- 8. Key indexes
CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_staff_school ON public.staff(school_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_school ON public.classrooms(school_id);
CREATE INDEX IF NOT EXISTS idx_class_arms_school ON public.class_arms(school_id);
CREATE INDEX IF NOT EXISTS idx_assignments_school ON public.assignments(school_id);
CREATE INDEX IF NOT EXISTS idx_events_school ON public.events(school_id);

-- 9. Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    (NEW.raw_user_meta_data ->> 'school_id')::uuid
  );
  RETURN NEW;
END;
$$;

-- 10. Update RLS: SELECT policies that used USING(true) → school-scoped
DROP POLICY IF EXISTS "Sessions viewable by authenticated" ON public.academic_sessions;
CREATE POLICY "Sessions viewable by school" ON public.academic_sessions FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "Classes viewable by authenticated" ON public.class_arms;
CREATE POLICY "Classes viewable by school" ON public.class_arms FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "Class subjects viewable by authenticated" ON public.class_subjects;
CREATE POLICY "Class subjects viewable by school" ON public.class_subjects FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "Fees viewable by authenticated" ON public.fee_structures;
CREATE POLICY "Fees viewable by school" ON public.fee_structures FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "Grading scales viewable by authenticated" ON public.grading_scales;
CREATE POLICY "Grading scales viewable by school" ON public.grading_scales FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "View attendance params" ON public.attendance_parameters;
CREATE POLICY "Attendance params viewable by school" ON public.attendance_parameters FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "Terms viewable by authenticated" ON public.terms;
CREATE POLICY "Terms viewable by school" ON public.terms FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "Special roles viewable by authenticated" ON public.special_roles;
CREATE POLICY "Special roles viewable by school" ON public.special_roles FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "View rubrics" ON public.grading_rubrics;
CREATE POLICY "Rubrics viewable by school" ON public.grading_rubrics FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "View attachments" ON public.attachments;
CREATE POLICY "Attachments viewable by school" ON public.attachments FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "View event participants" ON public.event_participants;
CREATE POLICY "Event participants viewable by school" ON public.event_participants FOR SELECT TO authenticated USING (public.same_school(school_id));

DROP POLICY IF EXISTS "View event supporters" ON public.event_supporters;
CREATE POLICY "Event supporters viewable by school" ON public.event_supporters FOR SELECT TO authenticated USING (public.same_school(school_id));

-- 11. Update staff-scoped SELECT policies with school scoping
DROP POLICY IF EXISTS "Staff can view all students" ON public.students;
CREATE POLICY "Staff view school students" ON public.students FOR SELECT TO authenticated USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff can view all attendance" ON public.attendance_records;
CREATE POLICY "Staff view school attendance" ON public.attendance_records FOR SELECT TO authenticated USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff view all payments" ON public.payments;
CREATE POLICY "Staff view school payments" ON public.payments FOR SELECT TO authenticated USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff view all scores" ON public.assessment_scores;
CREATE POLICY "Staff view school scores" ON public.assessment_scores FOR SELECT TO authenticated USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff view expenses" ON public.school_expenses;
CREATE POLICY "Staff view school expenses" ON public.school_expenses FOR SELECT TO authenticated USING (is_staff(auth.uid()) AND same_school(school_id));

-- 12. Update management ALL policies with school scoping
DROP POLICY IF EXISTS "Admins manage sessions" ON public.academic_sessions;
CREATE POLICY "Admins manage school sessions" ON public.academic_sessions FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Admins manage classes" ON public.class_arms;
CREATE POLICY "Admins manage school classes" ON public.class_arms FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Admins manage class subjects" ON public.class_subjects;
CREATE POLICY "Admins manage school subjects" ON public.class_subjects FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Admins manage terms" ON public.terms;
CREATE POLICY "Admins manage school terms" ON public.terms FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Admins manage grading scales" ON public.grading_scales;
CREATE POLICY "Admins manage school grading scales" ON public.grading_scales FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff can manage students" ON public.students;
CREATE POLICY "Staff manage school students" ON public.students FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff can manage attendance" ON public.attendance_records;
CREATE POLICY "Staff manage school attendance" ON public.attendance_records FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff manage scores" ON public.assessment_scores;
CREATE POLICY "Staff manage school scores" ON public.assessment_scores FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Accountants manage fees" ON public.fee_structures;
CREATE POLICY "Accountants manage school fees" ON public.fee_structures FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Accountants manage payments" ON public.payments;
CREATE POLICY "Accountants manage school payments" ON public.payments FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Admins manage special roles" ON public.special_roles;
CREATE POLICY "Admins manage school special roles" ON public.special_roles FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Admins manage attendance params" ON public.attendance_parameters;
CREATE POLICY "Admins manage school attendance params" ON public.attendance_parameters FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff manage expenses" ON public.school_expenses;
CREATE POLICY "Staff manage school expenses" ON public.school_expenses FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role) OR has_role(auth.uid(), 'accountant'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Admins manage broadsheet fields" ON public.broadsheet_fields;
CREATE POLICY "Admins manage school broadsheet fields" ON public.broadsheet_fields FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role)) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff view broadsheet fields" ON public.broadsheet_fields;
CREATE POLICY "Staff view school broadsheet fields" ON public.broadsheet_fields FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff manage assessment scores" ON public.assessment_scores_tracker;
CREATE POLICY "Staff manage school assessment scores" ON public.assessment_scores_tracker FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff manage rubrics" ON public.grading_rubrics;
CREATE POLICY "Staff manage school rubrics" ON public.grading_rubrics FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

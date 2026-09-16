-- Create role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'principal', 'teacher', 'student', 'parent', 'accountant');

-- Create user roles table (security best practice - roles in separate table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Academic sessions (e.g., 2024/2025)
CREATE TABLE public.academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;

-- Terms within a session
CREATE TABLE public.terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  term_number INTEGER NOT NULL CHECK (term_number IN (1, 2, 3)),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

-- Class levels (e.g., JSS 1, SS 2)
CREATE TYPE public.class_level AS ENUM ('primary', 'junior_secondary', 'senior_secondary');

CREATE TABLE public.class_arms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  arm TEXT NOT NULL,
  level class_level NOT NULL,
  class_teacher_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.class_arms ENABLE ROW LEVEL SECURITY;

-- Subjects
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Subject-Class assignment (which subjects are taught in which class)
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.class_arms(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id),
  UNIQUE (class_id, subject_id)
);
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

-- Students table
CREATE TYPE public.enrollment_status AS ENUM ('active', 'graduated', 'transferred', 'suspended');
CREATE TYPE public.gender_type AS ENUM ('male', 'female');

CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  admission_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE,
  gender gender_type NOT NULL,
  class_id UUID REFERENCES public.class_arms(id),
  parent_id UUID REFERENCES auth.users(id),
  avatar_url TEXT,
  enrollment_status enrollment_status DEFAULT 'active',
  enrollment_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Attendance records
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL,
  marked_by UUID REFERENCES auth.users(id),
  period INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date, period)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Virtual classrooms (LMS)
CREATE TABLE public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  class_id UUID REFERENCES public.class_arms(id),
  subject_id UUID REFERENCES public.subjects(id),
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  banner_color TEXT DEFAULT '#0B1F3B',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

-- Classroom members (students enrolled in a classroom)
CREATE TABLE public.classroom_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id)
);
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;

-- Stream posts in classrooms
CREATE TABLE public.stream_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stream_posts ENABLE ROW LEVEL SECURITY;

-- Comments on stream posts
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.stream_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Attachments (reusable for posts, assignments, etc.)
CREATE TYPE public.attachment_type AS ENUM ('file', 'link', 'video', 'image');

CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type attachment_type NOT NULL,
  url TEXT NOT NULL,
  size_bytes BIGINT,
  post_id UUID REFERENCES public.stream_posts(id) ON DELETE CASCADE,
  assignment_id UUID,
  submission_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Assignments
CREATE TYPE public.assignment_status AS ENUM ('draft', 'published', 'scheduled');

CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  topic TEXT,
  due_date DATE,
  due_time TIME,
  points INTEGER,
  status assignment_status DEFAULT 'draft',
  allow_late_submission BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Add foreign key for attachments to assignments
ALTER TABLE public.attachments ADD CONSTRAINT fk_attachments_assignment 
  FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;

-- Student submissions
CREATE TYPE public.submission_status AS ENUM ('submitted', 'graded', 'returned');

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN DEFAULT false,
  grade DECIMAL(5,2),
  feedback TEXT,
  status submission_status DEFAULT 'submitted',
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),
  UNIQUE (assignment_id, student_id)
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Add foreign key for attachments to submissions
ALTER TABLE public.attachments ADD CONSTRAINT fk_attachments_submission 
  FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;

-- Assessment scores (CA + Exam)
CREATE TABLE public.assessment_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  ca1 DECIMAL(5,2),
  ca2 DECIMAL(5,2),
  ca3 DECIMAL(5,2),
  exam DECIMAL(5,2),
  total DECIMAL(5,2) GENERATED ALWAYS AS (COALESCE(ca1, 0) + COALESCE(ca2, 0) + COALESCE(ca3, 0) + COALESCE(exam, 0)) STORED,
  grade TEXT,
  remarks TEXT,
  entered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, term_id)
);
ALTER TABLE public.assessment_scores ENABLE ROW LEVEL SECURITY;

-- Fee structures
CREATE TABLE public.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES public.class_arms(id),
  term_id UUID REFERENCES public.terms(id),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

-- Payments
CREATE TYPE public.payment_method AS ENUM ('cash', 'bank_transfer', 'pos', 'online');
CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'failed');

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id UUID NOT NULL REFERENCES public.fee_structures(id),
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method payment_method NOT NULL,
  receipt_number TEXT UNIQUE,
  status payment_status DEFAULT 'pending',
  recorded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TYPE public.notification_type AS ENUM ('info', 'warning', 'success', 'alert');

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type notification_type DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Check if user is staff (admin, principal, teacher, or accountant)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('admin', 'principal', 'teacher', 'accountant')
  )
$$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stream_posts_updated_at BEFORE UPDATE ON public.stream_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assessment_scores_updated_at BEFORE UPDATE ON public.assessment_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- User roles: users can view their own roles, admins can manage all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: users can view all profiles, edit own
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Academic sessions: viewable by all authenticated, managed by admins
CREATE POLICY "Sessions viewable by authenticated" ON public.academic_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sessions" ON public.academic_sessions FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'));

-- Terms: viewable by all authenticated, managed by admins
CREATE POLICY "Terms viewable by authenticated" ON public.terms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage terms" ON public.terms FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'));

-- Class arms: viewable by all authenticated, managed by admins
CREATE POLICY "Classes viewable by authenticated" ON public.class_arms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage classes" ON public.class_arms FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'));

-- Subjects: viewable by all authenticated, managed by admins
CREATE POLICY "Subjects viewable by authenticated" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'));

-- Class subjects: viewable by all authenticated, managed by admins
CREATE POLICY "Class subjects viewable by authenticated" ON public.class_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage class subjects" ON public.class_subjects FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'));

-- Students: viewable by staff, own student by student/parent
CREATE POLICY "Staff can view all students" ON public.students FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Students view own record" ON public.students FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Parents view children" ON public.students FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY "Staff can manage students" ON public.students FOR ALL USING (public.is_staff(auth.uid()));

-- Attendance: staff can manage, students/parents view own
CREATE POLICY "Staff can view all attendance" ON public.attendance_records FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Students view own attendance" ON public.attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students WHERE students.id = attendance_records.student_id AND students.user_id = auth.uid())
);
CREATE POLICY "Parents view children attendance" ON public.attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students WHERE students.id = attendance_records.student_id AND students.parent_id = auth.uid())
);
CREATE POLICY "Staff can manage attendance" ON public.attendance_records FOR ALL USING (public.is_staff(auth.uid()));

-- Classrooms: teachers manage own, students view enrolled
CREATE POLICY "Teachers view own classrooms" ON public.classrooms FOR SELECT USING (teacher_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Students view enrolled classrooms" ON public.classrooms FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.classroom_members cm JOIN public.students s ON cm.student_id = s.id WHERE cm.classroom_id = classrooms.id AND s.user_id = auth.uid())
);
CREATE POLICY "Teachers manage own classrooms" ON public.classrooms FOR ALL USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Classroom members
CREATE POLICY "View classroom members" ON public.classroom_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_members.classroom_id AND (c.teacher_id = auth.uid() OR public.is_staff(auth.uid())))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = classroom_members.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Staff manage members" ON public.classroom_members FOR ALL USING (public.is_staff(auth.uid()));

-- Stream posts: classroom participants can view and post
CREATE POLICY "View stream posts" ON public.stream_posts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = stream_posts.classroom_id AND c.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.classroom_members cm JOIN public.students s ON cm.student_id = s.id WHERE cm.classroom_id = stream_posts.classroom_id AND s.user_id = auth.uid())
  OR public.is_staff(auth.uid())
);
CREATE POLICY "Teachers create posts" ON public.stream_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = classroom_id AND c.teacher_id = auth.uid()) OR public.is_staff(auth.uid())
);
CREATE POLICY "Authors manage own posts" ON public.stream_posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors delete own posts" ON public.stream_posts FOR DELETE USING (author_id = auth.uid() OR public.is_staff(auth.uid()));

-- Post comments
CREATE POLICY "View comments" ON public.post_comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.stream_posts p WHERE p.id = post_comments.post_id)
);
CREATE POLICY "Authenticated create comments" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors manage own comments" ON public.post_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Delete own comments" ON public.post_comments FOR DELETE USING (author_id = auth.uid() OR public.is_staff(auth.uid()));

-- Attachments
CREATE POLICY "View attachments" ON public.attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage attachments" ON public.attachments FOR ALL USING (public.is_staff(auth.uid()));

-- Assignments
CREATE POLICY "View assignments" ON public.assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = assignments.classroom_id AND c.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.classroom_members cm JOIN public.students s ON cm.student_id = s.id WHERE cm.classroom_id = assignments.classroom_id AND s.user_id = auth.uid())
  OR public.is_staff(auth.uid())
);
CREATE POLICY "Teachers manage assignments" ON public.assignments FOR ALL USING (created_by = auth.uid() OR public.is_staff(auth.uid()));

-- Submissions
CREATE POLICY "Teachers view submissions" ON public.submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.assignments a JOIN public.classrooms c ON a.classroom_id = c.id WHERE a.id = submissions.assignment_id AND c.teacher_id = auth.uid())
  OR public.is_staff(auth.uid())
);
CREATE POLICY "Students view own submissions" ON public.submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = submissions.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Students submit own work" ON public.submissions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Students update own submissions" ON public.submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = submissions.student_id AND s.user_id = auth.uid()) AND status = 'submitted'
);
CREATE POLICY "Teachers grade submissions" ON public.submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.assignments a JOIN public.classrooms c ON a.classroom_id = c.id WHERE a.id = submissions.assignment_id AND c.teacher_id = auth.uid())
  OR public.is_staff(auth.uid())
);

-- Assessment scores
CREATE POLICY "Staff view all scores" ON public.assessment_scores FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Students view own scores" ON public.assessment_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = assessment_scores.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Parents view children scores" ON public.assessment_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = assessment_scores.student_id AND s.parent_id = auth.uid())
);
CREATE POLICY "Staff manage scores" ON public.assessment_scores FOR ALL USING (public.is_staff(auth.uid()));

-- Fee structures: viewable by all authenticated, managed by accountants/admins
CREATE POLICY "Fees viewable by authenticated" ON public.fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Accountants manage fees" ON public.fee_structures FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- Payments
CREATE POLICY "Staff view all payments" ON public.payments FOR SELECT USING (public.is_staff(auth.uid()));
CREATE POLICY "Students view own payments" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = payments.student_id AND s.user_id = auth.uid())
);
CREATE POLICY "Parents view children payments" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.students s WHERE s.id = payments.student_id AND s.parent_id = auth.uid())
);
CREATE POLICY "Accountants manage payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- Notifications: users see own
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System creates notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
-- Student fee obligations.
--
-- Until now, `payments` only recorded money that had actually been
-- paid — there was no concept of what a student was expected to owe
-- in the first place, so a "Pending" balance could only ever mean
-- "payments awaiting confirmation," never "fees not yet paid at all."
--
-- This adds that missing layer: every active student in a class
-- automatically owes every fee_structure assigned to that class (or
-- to the whole school, if a fee_structure has no class_id). Admin can
-- waive a specific student's fee, override its amount for that
-- student, or add/remove one manually — without touching the shared
-- fee_structures record other students are also billed against.

CREATE TABLE public.student_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_structure_id uuid NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  -- NULL = use fee_structures.amount as-is. Set = admin override for
  -- this student only (e.g. a sibling discount).
  custom_amount numeric(12,2),
  waived boolean NOT NULL DEFAULT false,
  waived_reason text,
  -- Distinguishes fees a student owes because they're in the matching
  -- class (system-generated) from ones an admin added by hand for a
  -- specific student outside the normal class assignment.
  auto_generated boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, fee_structure_id)
);

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view student fees" ON public.student_fees
FOR SELECT TO authenticated
USING (is_staff(auth.uid()) AND same_school(school_id));

CREATE POLICY "Admins manage student fees" ON public.student_fees
FOR ALL TO authenticated
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

CREATE POLICY "Students view own fees" ON public.student_fees
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

CREATE POLICY "Parents view children fees" ON public.student_fees
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.parent_id = auth.uid()));

CREATE INDEX idx_student_fees_student ON public.student_fees(student_id);
CREATE INDEX idx_student_fees_school ON public.student_fees(school_id);

CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.autofill_school_id();

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend the shared autofill function with a direct resolution path
-- for student_fees (falls back to the acting user's own school
-- otherwise, which is correct for admin-initiated writes but not for
-- the trigger-driven bulk generation below, which always runs in the
-- context of whoever created the fee_structure or enrolled the
-- student — same school either way, but explicit is safer).
CREATE OR REPLACE FUNCTION public.autofill_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
BEGIN
  BEGIN
    EXECUTE format('SELECT ($1).school_id') INTO v_school USING NEW;
  EXCEPTION WHEN others THEN
    v_school := NULL;
  END;

  IF v_school IS NOT NULL THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'classroom_members' THEN
      SELECT c.school_id INTO v_school FROM public.classrooms c WHERE c.id = NEW.classroom_id;
    WHEN 'classroom_co_teachers' THEN
      SELECT c.school_id INTO v_school FROM public.classrooms c WHERE c.id = NEW.classroom_id;
    WHEN 'classroom_materials' THEN
      SELECT c.school_id INTO v_school FROM public.classrooms c WHERE c.id = NEW.classroom_id;
    WHEN 'classroom_syllabus' THEN
      SELECT c.school_id INTO v_school FROM public.classrooms c WHERE c.id = NEW.classroom_id;
    WHEN 'live_class_sessions' THEN
      SELECT c.school_id INTO v_school FROM public.classrooms c WHERE c.id = NEW.classroom_id;
    WHEN 'assignments' THEN
      SELECT c.school_id INTO v_school FROM public.classrooms c WHERE c.id = NEW.classroom_id;
    WHEN 'stream_posts' THEN
      SELECT c.school_id INTO v_school FROM public.classrooms c WHERE c.id = NEW.classroom_id;
    WHEN 'post_comments' THEN
      SELECT p.school_id INTO v_school FROM public.stream_posts p WHERE p.id = NEW.post_id;
    WHEN 'quiz_questions' THEN
      SELECT q.school_id INTO v_school FROM public.quizzes q WHERE q.id = NEW.quiz_id;
    WHEN 'quiz_attempts' THEN
      SELECT q.school_id INTO v_school FROM public.quizzes q WHERE q.id = NEW.quiz_id;
    WHEN 'quiz_answers' THEN
      SELECT a.school_id INTO v_school FROM public.quiz_attempts a WHERE a.id = NEW.attempt_id;
    WHEN 'submissions' THEN
      IF NEW.assignment_id IS NOT NULL THEN
        SELECT a.school_id INTO v_school FROM public.assignments a WHERE a.id = NEW.assignment_id;
      ELSIF NEW.quiz_id IS NOT NULL THEN
        SELECT q.school_id INTO v_school FROM public.quizzes q WHERE q.id = NEW.quiz_id;
      END IF;
    WHEN 'attachments' THEN
      IF NEW.assignment_id IS NOT NULL THEN
        SELECT a.school_id INTO v_school FROM public.assignments a WHERE a.id = NEW.assignment_id;
      ELSIF NEW.submission_id IS NOT NULL THEN
        SELECT s.school_id INTO v_school FROM public.submissions s WHERE s.id = NEW.submission_id;
      ELSIF NEW.post_id IS NOT NULL THEN
        SELECT p.school_id INTO v_school FROM public.stream_posts p WHERE p.id = NEW.post_id;
      END IF;
    WHEN 'event_participants' THEN
      SELECT e.school_id INTO v_school FROM public.events e WHERE e.id = NEW.event_id;
    WHEN 'event_supporters' THEN
      SELECT e.school_id INTO v_school FROM public.events e WHERE e.id = NEW.event_id;
    WHEN 'broadsheet_field_scores' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;
    WHEN 'assessment_scores' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;
    WHEN 'assessment_scores_tracker' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;
    WHEN 'attendance_records' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;
    WHEN 'payments' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;
    WHEN 'result_transcripts' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;
    WHEN 'message_recipients' THEN
      SELECT m.school_id INTO v_school FROM public.messages m WHERE m.id = NEW.message_id;
    WHEN 'parent_notifications' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.child_id;
    WHEN 'student_fees' THEN
      SELECT s.school_id INTO v_school FROM public.students s WHERE s.id = NEW.student_id;
    ELSE
      v_school := NULL;
  END CASE;

  IF v_school IS NULL THEN
    v_school := public.get_user_school_id(auth.uid());
  END IF;

  IF v_school IS NOT NULL THEN
    NEW.school_id := v_school;
  END IF;

  RETURN NEW;
END;
$$;

-- When a fee_structure is created, generate a student_fees row for
-- every currently-active student it applies to: students in the
-- matching class, or every active student in the school if the fee
-- has no class_id (a school-wide fee like a PTA levy).
CREATE OR REPLACE FUNCTION public.sync_student_fees_for_new_structure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, auto_generated)
  SELECT NEW.school_id, s.id, NEW.id, true
  FROM public.students s
  WHERE s.school_id = NEW.school_id
    AND s.enrollment_status = 'active'
    AND (NEW.class_id IS NULL OR s.class_id = NEW.class_id)
  ON CONFLICT (student_id, fee_structure_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_student_fees_on_structure_insert
  AFTER INSERT ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.sync_student_fees_for_new_structure();

-- When a student is newly enrolled, or moved to a different class,
-- generate student_fees rows for every fee_structure that now applies
-- to them. Existing rows (from their previous class, or manually
-- added/overridden by admin) are untouched — a fee already incurred
-- doesn't disappear just because the student changed class.
CREATE OR REPLACE FUNCTION public.sync_student_fees_for_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.enrollment_status = 'active' AND NEW.class_id IS NOT NULL THEN
    INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, auto_generated)
    SELECT NEW.school_id, NEW.id, fs.id, true
    FROM public.fee_structures fs
    WHERE fs.school_id = NEW.school_id
      AND (fs.class_id IS NULL OR fs.class_id = NEW.class_id)
    ON CONFLICT (student_id, fee_structure_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_student_fees_on_student_change
  AFTER INSERT OR UPDATE OF class_id, enrollment_status ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_student_fees_for_student();

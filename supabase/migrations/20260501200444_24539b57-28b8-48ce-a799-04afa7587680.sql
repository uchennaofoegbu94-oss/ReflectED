
-- ============================================
-- Generic school_id auto-fill trigger function
-- ============================================
CREATE OR REPLACE FUNCTION public.autofill_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
BEGIN
  -- Already set? Use it.
  BEGIN
    EXECUTE format('SELECT ($1).school_id') INTO v_school USING NEW;
  EXCEPTION WHEN others THEN
    v_school := NULL;
  END;

  IF v_school IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Derive from related entity depending on table
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
    ELSE
      v_school := NULL;
  END CASE;

  -- Final fallback: derive from the authenticated user's profile
  IF v_school IS NULL THEN
    v_school := public.get_user_school_id(auth.uid());
  END IF;

  IF v_school IS NOT NULL THEN
    NEW.school_id := v_school;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- Attach the trigger to every table with school_id
-- ============================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academic_sessions','assessment_scores','assessment_scores_tracker',
    'assignment_notifications','assignments','attachments','attendance_parameters',
    'attendance_records','audit_log','broadsheet_field_scores','broadsheet_fields',
    'class_arms','class_subjects','classroom_co_teachers','classroom_materials',
    'classroom_members','classroom_syllabus','classrooms','event_participants',
    'event_supporters','events','fee_structures','grading_rubrics','grading_scales',
    'live_class_sessions','login_history','message_recipients','messages',
    'notifications','parent_notifications','payments','post_comments','profiles',
    'quiz_answers','quiz_attempts','quiz_questions','quizzes','result_transcripts',
    'role_definitions','school_expenses','school_settings','special_roles','staff',
    'staff_clock_records','stream_posts','students','subjects','submissions',
    'support_tickets','terms','timetable_slots','user_roles','assignment_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.autofill_school_id()',
      t
    );
  END LOOP;
END $$;

-- ============================================
-- Backfill missing school_id on existing data
-- ============================================
UPDATE public.classrooms c SET school_id = s.school_id
FROM public.staff s WHERE c.teacher_id = s.id AND c.school_id IS NULL AND s.school_id IS NOT NULL;

UPDATE public.classroom_members cm SET school_id = c.school_id
FROM public.classrooms c WHERE cm.classroom_id = c.id AND cm.school_id IS NULL;

UPDATE public.classroom_co_teachers x SET school_id = c.school_id
FROM public.classrooms c WHERE x.classroom_id = c.id AND x.school_id IS NULL;

UPDATE public.classroom_materials x SET school_id = c.school_id
FROM public.classrooms c WHERE x.classroom_id = c.id AND x.school_id IS NULL;

UPDATE public.classroom_syllabus x SET school_id = c.school_id
FROM public.classrooms c WHERE x.classroom_id = c.id AND x.school_id IS NULL;

UPDATE public.live_class_sessions x SET school_id = c.school_id
FROM public.classrooms c WHERE x.classroom_id = c.id AND x.school_id IS NULL;

UPDATE public.assignments a SET school_id = c.school_id
FROM public.classrooms c WHERE a.classroom_id = c.id AND a.school_id IS NULL;

UPDATE public.stream_posts p SET school_id = c.school_id
FROM public.classrooms c WHERE p.classroom_id = c.id AND p.school_id IS NULL;

UPDATE public.post_comments pc SET school_id = sp.school_id
FROM public.stream_posts sp WHERE pc.post_id = sp.id AND pc.school_id IS NULL;

UPDATE public.quiz_questions qq SET school_id = q.school_id
FROM public.quizzes q WHERE qq.quiz_id = q.id AND qq.school_id IS NULL;

UPDATE public.quiz_attempts qa SET school_id = q.school_id
FROM public.quizzes q WHERE qa.quiz_id = q.id AND qa.school_id IS NULL;

UPDATE public.quiz_answers ans SET school_id = qa.school_id
FROM public.quiz_attempts qa WHERE ans.attempt_id = qa.id AND ans.school_id IS NULL;

UPDATE public.submissions s SET school_id = a.school_id
FROM public.assignments a WHERE s.assignment_id = a.id AND s.school_id IS NULL;

UPDATE public.submissions s SET school_id = q.school_id
FROM public.quizzes q WHERE s.quiz_id = q.id AND s.school_id IS NULL;

UPDATE public.attachments at SET school_id = a.school_id
FROM public.assignments a WHERE at.assignment_id = a.id AND at.school_id IS NULL;

UPDATE public.attachments at SET school_id = sub.school_id
FROM public.submissions sub WHERE at.submission_id = sub.id AND at.school_id IS NULL;

UPDATE public.attachments at SET school_id = sp.school_id
FROM public.stream_posts sp WHERE at.post_id = sp.id AND at.school_id IS NULL;

UPDATE public.event_participants ep SET school_id = e.school_id
FROM public.events e WHERE ep.event_id = e.id AND ep.school_id IS NULL;

UPDATE public.event_supporters es SET school_id = e.school_id
FROM public.events e WHERE es.event_id = e.id AND es.school_id IS NULL;

UPDATE public.broadsheet_field_scores bfs SET school_id = s.school_id
FROM public.students s WHERE bfs.student_id = s.id AND bfs.school_id IS NULL;

UPDATE public.assessment_scores asc1 SET school_id = s.school_id
FROM public.students s WHERE asc1.student_id = s.id AND asc1.school_id IS NULL;

UPDATE public.assessment_scores_tracker ast SET school_id = s.school_id
FROM public.students s WHERE ast.student_id = s.id AND ast.school_id IS NULL;

UPDATE public.attendance_records ar SET school_id = s.school_id
FROM public.students s WHERE ar.student_id = s.id AND ar.school_id IS NULL;

UPDATE public.payments p SET school_id = s.school_id
FROM public.students s WHERE p.student_id = s.id AND p.school_id IS NULL;

UPDATE public.result_transcripts rt SET school_id = s.school_id
FROM public.students s WHERE rt.student_id = s.id AND rt.school_id IS NULL;

UPDATE public.message_recipients mr SET school_id = m.school_id
FROM public.messages m WHERE mr.message_id = m.id AND mr.school_id IS NULL;

UPDATE public.parent_notifications pn SET school_id = s.school_id
FROM public.students s WHERE pn.child_id = s.id AND pn.school_id IS NULL;

UPDATE public.user_roles ur SET school_id = pr.school_id
FROM public.profiles pr WHERE ur.user_id = pr.user_id AND ur.school_id IS NULL;

UPDATE public.notifications n SET school_id = pr.school_id
FROM public.profiles pr WHERE n.user_id = pr.user_id AND n.school_id IS NULL;

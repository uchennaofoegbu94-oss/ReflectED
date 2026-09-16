-- Batch 3: #1 form-teacher attendance scoping + #2 Pre-CA/Broadsheet subject-teacher scoping
--
-- Two teacher->class/subject assignment mechanisms already exist in this schema and
-- both are honored here:
--   1. class_arms.class_teacher_id  — the form teacher of a class (set via Classes page)
--   2. class_subjects.teacher_id    — a teacher assigned to a subject within a class
--   3. classrooms (virtual classroom: class_id + subject_id + teacher_id, plus
--      classroom_co_teachers) — used by GradesTab.tsx / ViewQuizDialog.tsx to push
--      grades into assessment_scores / broadsheet_field_scores. A teacher who owns
--      or co-teaches a subject-linked classroom must retain write access even if a
--      matching class_subjects row was never created, so classroom ownership is
--      folded into the scoping check alongside class_subjects.
--
-- Note: public.special_roles has its own separate 'form_teacher' badge (assigned via
-- AssignRoleDialog) that is NOT synced to class_arms.class_teacher_id — it's a
-- recognition/badge system, not a structural assignment. class_arms.class_teacher_id
-- is used here as the authoritative source for permission checks since it's the
-- actual FK driving which teacher owns a class.

-- 1. Helper: is the current user the form teacher of this class?
CREATE OR REPLACE FUNCTION public.is_form_teacher_of_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_arms
    WHERE id = _class_id AND class_teacher_id = public.get_my_staff_id()
  )
$$;

-- 2. Helper: does the current user teach this subject in this class, via either
--    class_subjects assignment or classroom ownership/co-teaching?
CREATE OR REPLACE FUNCTION public.teaches_subject_in_class(_class_id uuid, _subject_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.class_subjects
      WHERE class_id = _class_id AND subject_id = _subject_id
        AND teacher_id = public.get_my_staff_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.class_id = _class_id AND c.subject_id = _subject_id
        AND (c.teacher_id = public.get_my_staff_id() OR public.is_classroom_co_teacher(c.id))
    )
$$;

-- 3. Helper: does the current user teach *any* subject in this class (used to decide
--    whether a class shows up at all in a teacher's class picker)?
CREATE OR REPLACE FUNCTION public.teaches_in_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_form_teacher_of_class(_class_id)
    OR EXISTS (
      SELECT 1 FROM public.class_subjects
      WHERE class_id = _class_id AND teacher_id = public.get_my_staff_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.class_id = _class_id
        AND (c.teacher_id = public.get_my_staff_id() OR public.is_classroom_co_teacher(c.id))
    )
$$;

-- 4. Helper: resolve the class a given attendance record belongs to — prefer the
--    session's class_id, fall back to the student's current class_id.
CREATE OR REPLACE FUNCTION public.attendance_record_class_id(_session_id uuid, _student_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT class_id FROM public.attendance_sessions WHERE id = _session_id),
    (SELECT class_id FROM public.students WHERE id = _student_id)
  )
$$;

-- 5. Helper: can the current user manage (insert/update/delete) a score for this
--    student+subject — form teacher of the student's class, or teaches that subject
--    in that class (class_subjects or classroom-based)?
CREATE OR REPLACE FUNCTION public.can_manage_score_for(_student_id uuid, _subject_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_form_teacher_of_class((SELECT class_id FROM public.students WHERE id = _student_id))
    OR public.teaches_subject_in_class((SELECT class_id FROM public.students WHERE id = _student_id), _subject_id)
$$;

-- ============================================================
-- #1 — Attendance: form-teacher-only access/marking, admin/principal override
-- ============================================================

-- attendance_sessions: replace broad is_staff() gating with form-teacher scoping.
-- Accountants previously had access purely as a side effect of is_staff() bundling
-- roles together — that wasn't an intentional attendance permission, so it's dropped
-- here along with the rest of the tightening.
DROP POLICY IF EXISTS "Staff view school attendance sessions" ON public.attendance_sessions;
CREATE POLICY "Form teachers and admins view attendance sessions"
  ON public.attendance_sessions FOR SELECT
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND class_id IS NOT NULL AND public.is_form_teacher_of_class(class_id))
    )
  );

DROP POLICY IF EXISTS "Staff create attendance sessions" ON public.attendance_sessions;
CREATE POLICY "Form teachers and admins create attendance sessions"
  ON public.attendance_sessions FOR INSERT
  WITH CHECK (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND class_id IS NOT NULL AND public.is_form_teacher_of_class(class_id))
    )
  );

DROP POLICY IF EXISTS "Staff update attendance sessions" ON public.attendance_sessions;
CREATE POLICY "Form teachers and admins update attendance sessions"
  ON public.attendance_sessions FOR UPDATE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (
        public.has_role(auth.uid(), 'teacher') AND status = 'open'
        AND class_id IS NOT NULL AND public.is_form_teacher_of_class(class_id)
      )
    )
  )
  WITH CHECK (public.same_school(school_id));

-- "Admins delete attendance sessions" already admin/principal-only — unchanged.

-- attendance_records: scope teacher access (view + insert/update/delete) to their
-- own form class; keep the existing session-lock check for writes.
DROP POLICY IF EXISTS "Staff view school attendance" ON public.attendance_records;
CREATE POLICY "Form teachers and admins view attendance records"
  ON public.attendance_records FOR SELECT
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (
        public.has_role(auth.uid(), 'teacher')
        AND public.is_form_teacher_of_class(public.attendance_record_class_id(session_id, student_id))
      )
    )
  );

DROP POLICY IF EXISTS "Staff insert school attendance" ON public.attendance_records;
CREATE POLICY "Form teachers and admins insert attendance records"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    public.same_school(school_id)
    AND (
      session_id IS NULL
      OR NOT public.attendance_session_locked(session_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
    )
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (
        public.has_role(auth.uid(), 'teacher')
        AND public.is_form_teacher_of_class(public.attendance_record_class_id(session_id, student_id))
      )
    )
  );

DROP POLICY IF EXISTS "Staff update school attendance" ON public.attendance_records;
CREATE POLICY "Form teachers and admins update attendance records"
  ON public.attendance_records FOR UPDATE
  USING (
    public.same_school(school_id)
    AND (
      session_id IS NULL
      OR NOT public.attendance_session_locked(session_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
    )
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (
        public.has_role(auth.uid(), 'teacher')
        AND public.is_form_teacher_of_class(public.attendance_record_class_id(session_id, student_id))
      )
    )
  )
  WITH CHECK (public.same_school(school_id));

DROP POLICY IF EXISTS "Staff delete school attendance" ON public.attendance_records;
CREATE POLICY "Form teachers and admins delete attendance records"
  ON public.attendance_records FOR DELETE
  USING (
    public.same_school(school_id)
    AND (
      session_id IS NULL
      OR NOT public.attendance_session_locked(session_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
    )
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (
        public.has_role(auth.uid(), 'teacher')
        AND public.is_form_teacher_of_class(public.attendance_record_class_id(session_id, student_id))
      )
    )
  );

-- ============================================================
-- #2 — Pre-CA/Broadsheet: subject-teacher scoping on score writes
-- (viewing stays broad/staff-wide, unchanged — this only scopes who can enter/edit)
-- ============================================================

DROP POLICY IF EXISTS "Staff manage school scores" ON public.assessment_scores;
CREATE POLICY "Scoped teachers and admins insert scores"
  ON public.assessment_scores FOR INSERT
  WITH CHECK (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND public.can_manage_score_for(student_id, subject_id))
    )
  );

CREATE POLICY "Scoped teachers and admins update scores"
  ON public.assessment_scores FOR UPDATE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND public.can_manage_score_for(student_id, subject_id))
    )
  )
  WITH CHECK (public.same_school(school_id));

CREATE POLICY "Scoped teachers and admins delete scores"
  ON public.assessment_scores FOR DELETE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND public.can_manage_score_for(student_id, subject_id))
    )
  );

-- broadsheet_field_scores previously relied entirely on its single FOR ALL policy —
-- including for SELECT. Splitting into scoped write policies means staff SELECT
-- needs its own explicit (still broad) policy or teachers would lose read access.
DROP POLICY IF EXISTS "Staff manage field scores" ON public.broadsheet_field_scores;
CREATE POLICY "Staff view school field scores"
  ON public.broadsheet_field_scores FOR SELECT
  USING (public.is_staff(auth.uid()) AND public.same_school(school_id));

CREATE POLICY "Scoped teachers and admins insert field scores"
  ON public.broadsheet_field_scores FOR INSERT
  WITH CHECK (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND public.can_manage_score_for(student_id, subject_id))
    )
  );

CREATE POLICY "Scoped teachers and admins update field scores"
  ON public.broadsheet_field_scores FOR UPDATE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND public.can_manage_score_for(student_id, subject_id))
    )
  )
  WITH CHECK (public.same_school(school_id));

CREATE POLICY "Scoped teachers and admins delete field scores"
  ON public.broadsheet_field_scores FOR DELETE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (public.has_role(auth.uid(), 'teacher') AND public.can_manage_score_for(student_id, subject_id))
    )
  );

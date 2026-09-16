
-- ==========================================
-- FIX TENANT ISOLATION: Add same_school() to all leaky policies
-- ==========================================

-- 1. PROFILES: was true for SELECT
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by school" ON public.profiles FOR SELECT TO authenticated
  USING (same_school(school_id) OR user_id = auth.uid());

-- 2. STAFF: was true for SELECT, admin manage without school check
DROP POLICY IF EXISTS "Staff viewable by authenticated" ON public.staff;
CREATE POLICY "Staff viewable by school" ON public.staff FOR SELECT TO authenticated
  USING (same_school(school_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage staff" ON public.staff;
CREATE POLICY "Admins manage school staff" ON public.staff FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

-- 3. SUBJECTS: was true for SELECT
DROP POLICY IF EXISTS "Subjects viewable by authenticated" ON public.subjects;
CREATE POLICY "Subjects viewable by school" ON public.subjects FOR SELECT TO authenticated
  USING (same_school(school_id));

DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins delete subjects" ON public.subjects;
CREATE POLICY "Admins manage school subjects" ON public.subjects FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

-- 4. TIMETABLE_SLOTS: was true for SELECT
DROP POLICY IF EXISTS "Timetable viewable by authenticated" ON public.timetable_slots;
CREATE POLICY "Timetable viewable by school" ON public.timetable_slots FOR SELECT TO authenticated
  USING (same_school(school_id));

DROP POLICY IF EXISTS "Admins manage timetable" ON public.timetable_slots;
CREATE POLICY "Admins manage school timetable" ON public.timetable_slots FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

-- 5. ROLE_DEFINITIONS: was true for SELECT
DROP POLICY IF EXISTS "Anyone can view role definitions" ON public.role_definitions;
CREATE POLICY "Role definitions viewable by school" ON public.role_definitions FOR SELECT TO authenticated
  USING (same_school(school_id));

DROP POLICY IF EXISTS "Admins manage role definitions" ON public.role_definitions;
DROP POLICY IF EXISTS "Admins manage role_definitions" ON public.role_definitions;
CREATE POLICY "Admins manage school role definitions" ON public.role_definitions FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

-- 6. SCHOOL_SETTINGS: was true for SELECT
DROP POLICY IF EXISTS "Staff view settings" ON public.school_settings;
CREATE POLICY "Settings viewable by school" ON public.school_settings FOR SELECT TO authenticated
  USING (same_school(school_id));

DROP POLICY IF EXISTS "Admins manage settings" ON public.school_settings;
CREATE POLICY "Admins manage school settings" ON public.school_settings FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

-- 7. EVENTS
DROP POLICY IF EXISTS "Admins manage all events" ON public.events;
CREATE POLICY "Admins manage school events" ON public.events FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

DROP POLICY IF EXISTS "Events viewable by authenticated" ON public.events;
CREATE POLICY "Events viewable by school" ON public.events FOR SELECT TO authenticated
  USING (same_school(school_id) AND is_active = true);

DROP POLICY IF EXISTS "Staff create events" ON public.events;
CREATE POLICY "Staff create school events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Coordinators manage own events" ON public.events;
CREATE POLICY "Coordinators manage own events" ON public.events FOR UPDATE TO authenticated
  USING (coordinator_id = auth.uid() AND same_school(school_id));

DROP POLICY IF EXISTS "Coordinators delete own events" ON public.events;
CREATE POLICY "Coordinators delete own events" ON public.events FOR DELETE TO authenticated
  USING (coordinator_id = auth.uid() AND same_school(school_id));

-- 8. CLASSROOMS
DROP POLICY IF EXISTS "Classrooms viewable by authenticated" ON public.classrooms;
CREATE POLICY "Classrooms viewable by school" ON public.classrooms FOR SELECT TO authenticated
  USING (is_archived = false AND same_school(school_id) AND (is_classroom_owner(id) OR is_classroom_co_teacher(id) OR is_staff(auth.uid()) OR is_classroom_member(id)));

-- 9. CLASSROOM_CO_TEACHERS
DROP POLICY IF EXISTS "Teachers manage co-teachers" ON public.classroom_co_teachers;
CREATE POLICY "Teachers manage co-teachers" ON public.classroom_co_teachers FOR ALL TO authenticated
  USING ((is_classroom_owner(classroom_id) OR is_staff(auth.uid())) AND same_school(school_id));

DROP POLICY IF EXISTS "View co-teachers" ON public.classroom_co_teachers;
CREATE POLICY "View co-teachers" ON public.classroom_co_teachers FOR SELECT TO authenticated
  USING (same_school(school_id));

-- 10. CLASSROOM_SYLLABUS
DROP POLICY IF EXISTS "Teachers manage syllabus" ON public.classroom_syllabus;
CREATE POLICY "Teachers manage syllabus" ON public.classroom_syllabus FOR ALL TO authenticated
  USING ((is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid())) AND same_school(school_id));

DROP POLICY IF EXISTS "View syllabus" ON public.classroom_syllabus;
CREATE POLICY "View syllabus" ON public.classroom_syllabus FOR SELECT TO authenticated
  USING (same_school(school_id) AND (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id)));

-- 11. CLASSROOM_MATERIALS
DROP POLICY IF EXISTS "Teachers manage materials" ON public.classroom_materials;
CREATE POLICY "Teachers manage materials" ON public.classroom_materials FOR ALL TO authenticated
  USING ((is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid())) AND same_school(school_id))
  WITH CHECK ((is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid())) AND same_school(school_id));

DROP POLICY IF EXISTS "View classroom materials" ON public.classroom_materials;
CREATE POLICY "View classroom materials" ON public.classroom_materials FOR SELECT TO authenticated
  USING (same_school(school_id) AND (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id)));

-- 12. CLASSROOM_MEMBERS
DROP POLICY IF EXISTS "Staff manage members" ON public.classroom_members;
CREATE POLICY "Staff manage members" ON public.classroom_members FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "View classroom members" ON public.classroom_members;
CREATE POLICY "View classroom members" ON public.classroom_members FOR SELECT TO authenticated
  USING (same_school(school_id) AND (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id)));

-- 13. STREAM_POSTS
DROP POLICY IF EXISTS "View stream posts" ON public.stream_posts;
CREATE POLICY "View stream posts" ON public.stream_posts FOR SELECT TO authenticated
  USING (same_school(school_id) AND (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id)));

DROP POLICY IF EXISTS "Teachers create posts" ON public.stream_posts;
CREATE POLICY "Teachers create posts" ON public.stream_posts FOR INSERT TO authenticated
  WITH CHECK (same_school(school_id) AND (is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid())));

DROP POLICY IF EXISTS "Authors delete own posts" ON public.stream_posts;
CREATE POLICY "Authors delete own posts" ON public.stream_posts FOR DELETE TO authenticated
  USING ((author_id = auth.uid() OR is_staff(auth.uid())) AND same_school(school_id));

-- 14. POST_COMMENTS
DROP POLICY IF EXISTS "View comments" ON public.post_comments;
CREATE POLICY "View comments" ON public.post_comments FOR SELECT TO authenticated
  USING (same_school(school_id));

DROP POLICY IF EXISTS "Delete own comments" ON public.post_comments;
CREATE POLICY "Delete own comments" ON public.post_comments FOR DELETE TO authenticated
  USING ((author_id = auth.uid() OR is_staff(auth.uid())) AND same_school(school_id));

DROP POLICY IF EXISTS "Authors manage own comments" ON public.post_comments;
CREATE POLICY "Authors manage own comments" ON public.post_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND same_school(school_id));

-- 15. ASSIGNMENTS
DROP POLICY IF EXISTS "Teachers manage assignments" ON public.assignments;
CREATE POLICY "Teachers manage assignments" ON public.assignments FOR ALL TO authenticated
  USING ((created_by = auth.uid() OR is_staff(auth.uid())) AND same_school(school_id));

DROP POLICY IF EXISTS "View assignments" ON public.assignments;
CREATE POLICY "View assignments" ON public.assignments FOR SELECT TO authenticated
  USING (same_school(school_id) AND (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id)));

-- 16. SUBMISSIONS
DROP POLICY IF EXISTS "Teachers view submissions" ON public.submissions;
CREATE POLICY "Teachers view submissions" ON public.submissions FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Teachers grade submissions" ON public.submissions;
CREATE POLICY "Teachers grade submissions" ON public.submissions FOR UPDATE TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

-- 17. ATTACHMENTS
DROP POLICY IF EXISTS "Staff manage attachments" ON public.attachments;
CREATE POLICY "Staff manage attachments" ON public.attachments FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Attachments viewable by school" ON public.attachments;
CREATE POLICY "Attachments viewable by school" ON public.attachments FOR SELECT TO authenticated
  USING (same_school(school_id));

-- 18. QUIZ_ATTEMPTS
DROP POLICY IF EXISTS "Staff view all attempts" ON public.quiz_attempts;
CREATE POLICY "Staff view all attempts" ON public.quiz_attempts FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff grade attempts" ON public.quiz_attempts;
CREATE POLICY "Staff grade attempts" ON public.quiz_attempts FOR UPDATE TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

-- 19. QUIZ_QUESTIONS
DROP POLICY IF EXISTS "Staff manage questions" ON public.quiz_questions;
CREATE POLICY "Staff manage questions" ON public.quiz_questions FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

-- 20. QUIZ_ANSWERS
DROP POLICY IF EXISTS "Staff view all answers" ON public.quiz_answers;
CREATE POLICY "Staff view all answers" ON public.quiz_answers FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Staff grade answers" ON public.quiz_answers;
CREATE POLICY "Staff grade answers" ON public.quiz_answers FOR UPDATE TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

-- 21. LIVE_CLASS_SESSIONS
DROP POLICY IF EXISTS "Teachers manage live sessions" ON public.live_class_sessions;
CREATE POLICY "Teachers manage live sessions" ON public.live_class_sessions FOR ALL TO authenticated
  USING ((is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_staff(auth.uid())) AND same_school(school_id));

DROP POLICY IF EXISTS "View live sessions" ON public.live_class_sessions;
CREATE POLICY "View live sessions" ON public.live_class_sessions FOR SELECT TO authenticated
  USING (same_school(school_id) AND (is_staff(auth.uid()) OR is_classroom_owner(classroom_id) OR is_classroom_co_teacher(classroom_id) OR is_classroom_member(classroom_id)));

-- 22. BROADSHEET_FIELD_SCORES
DROP POLICY IF EXISTS "Staff manage field scores" ON public.broadsheet_field_scores;
CREATE POLICY "Staff manage field scores" ON public.broadsheet_field_scores FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

-- 23. RESULT_TRANSCRIPTS
DROP POLICY IF EXISTS "Staff manage transcripts" ON public.result_transcripts;
CREATE POLICY "Staff manage transcripts" ON public.result_transcripts FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id));

-- 24. STAFF_CLOCK_RECORDS
DROP POLICY IF EXISTS "Staff manage own clock records" ON public.staff_clock_records;
CREATE POLICY "Staff manage own clock records" ON public.staff_clock_records FOR INSERT TO authenticated
  WITH CHECK (same_school(school_id) AND (EXISTS (SELECT 1 FROM staff s WHERE s.id = staff_clock_records.staff_id AND s.user_id = auth.uid()) OR is_staff(auth.uid())));

DROP POLICY IF EXISTS "Staff update own clock records" ON public.staff_clock_records;
CREATE POLICY "Staff update own clock records" ON public.staff_clock_records FOR UPDATE TO authenticated
  USING (same_school(school_id) AND (EXISTS (SELECT 1 FROM staff s WHERE s.id = staff_clock_records.staff_id AND s.user_id = auth.uid()) OR is_staff(auth.uid())));

DROP POLICY IF EXISTS "Staff view own clock records" ON public.staff_clock_records;
CREATE POLICY "Staff view own clock records" ON public.staff_clock_records FOR SELECT TO authenticated
  USING (same_school(school_id) AND (EXISTS (SELECT 1 FROM staff s WHERE s.id = staff_clock_records.staff_id AND s.user_id = auth.uid()) OR is_staff(auth.uid())));

-- 25. MESSAGES
DROP POLICY IF EXISTS "Staff view broadcast messages" ON public.messages;
CREATE POLICY "Staff view broadcast messages" ON public.messages FOR SELECT TO authenticated
  USING (is_broadcast = true AND is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Authenticated users create messages" ON public.messages;
CREATE POLICY "Staff create messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_staff(auth.uid()) AND same_school(school_id));

-- 26. MESSAGE_RECIPIENTS
DROP POLICY IF EXISTS "Staff create recipients" ON public.message_recipients;
CREATE POLICY "Staff create recipients" ON public.message_recipients FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()) AND same_school(school_id));

-- 27. USER_ROLES: add school visibility
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND same_school(school_id));

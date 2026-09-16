-- Fix #10 (systematic RLS audit — first batch of confirmed leaks)
--
-- Method: every CREATE POLICY across every migration was extracted (accounting
-- for later DROP/CREATE replacements) and checked for either same_school()
-- scoping or an auth.uid()-based ownership check. Four gaps confirmed real —
-- not false positives from ownership-based scoping, which is equally valid
-- but doesn't match a text search for "same_school".

-- 1. event_participants: "Staff manage participants" (FOR ALL) had no
-- scoping at all beyond "is a staff member of ANY school" — any teacher/
-- admin from any school could view, add, or remove another school's event
-- participants. The column and its SELECT-policy sibling were already
-- correctly using same_school(school_id); this ALL policy was just never
-- updated to match when that scoping pass happened.
DROP POLICY IF EXISTS "Staff manage participants" ON public.event_participants;
CREATE POLICY "Staff manage school event participants"
  ON public.event_participants FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id))
  WITH CHECK (is_staff(auth.uid()) AND same_school(school_id));

-- 2. event_supporters: same gap, both for staff management and for a
-- parent supporting/joining an event — a parent could currently register
-- support for an event belonging to a completely different school.
DROP POLICY IF EXISTS "Staff manage supporters" ON public.event_supporters;
CREATE POLICY "Staff manage school event supporters"
  ON public.event_supporters FOR ALL TO authenticated
  USING (is_staff(auth.uid()) AND same_school(school_id))
  WITH CHECK (is_staff(auth.uid()) AND same_school(school_id));

DROP POLICY IF EXISTS "Parents support events" ON public.event_supporters;
CREATE POLICY "Parents support school events"
  ON public.event_supporters FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'parent') AND same_school(school_id));

-- 3. quizzes: "Staff manage quizzes" (FOR ALL) had zero school scoping —
-- any teacher/admin from any school could view, edit, or delete any other
-- school's quizzes, including question content. This is the most serious
-- of the four given it touches exam material directly.
DROP POLICY IF EXISTS "Staff manage quizzes" ON public.quizzes;
CREATE POLICY "Staff manage school quizzes"
  ON public.quizzes FOR ALL TO authenticated
  USING ((is_staff(auth.uid()) OR created_by = auth.uid()) AND same_school(school_id))
  WITH CHECK ((is_staff(auth.uid()) OR created_by = auth.uid()) AND same_school(school_id));

-- 4. audit_log: an older, unscoped INSERT policy ("Staff insert own audit
-- log entries" — is_staff(auth.uid()) with no same_school check) was left
-- in place alongside the properly-scoped one added when the SELECT leak
-- was fixed earlier. RLS is permissive-OR, so the old one still let any
-- staff member insert an audit_log row claiming ANY school_id — a write-
-- injection path into another school's audit trail. The scoped policy
-- already covers every legitimate insert, so the old one is just dropped.
DROP POLICY IF EXISTS "Staff insert own audit log entries" ON public.audit_log;

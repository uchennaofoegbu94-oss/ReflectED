
-- Phase 6: RLS Repair

-- 1) Replace always-true INSERT policies
DROP POLICY IF EXISTS "System inserts audit log" ON public.audit_log;
CREATE POLICY "Staff insert own audit log entries"
ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff(auth.uid())
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "System creates notifications" ON public.notifications;
CREATE POLICY "Users create their own notifications"
ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System creates notifications" ON public.assignment_notifications;
CREATE POLICY "Users create their own assignment notifications"
ON public.assignment_notifications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "System creates parent notifications" ON public.parent_notifications;
CREATE POLICY "Parents create their own notifications"
ON public.parent_notifications
FOR INSERT TO authenticated
WITH CHECK (parent_id = auth.uid());

-- 2) Storage policy cleanup
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;

CREATE POLICY "Public read access to avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Lock down SECURITY DEFINER trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.autofill_school_id()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_assessment_score()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_assessment_score()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_quiz_attempt_to_submission()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.propagate_submission_to_broadsheet()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_parent_on_event_participation()  FROM PUBLIC, anon, authenticated;

-- 4) Revoke EXECUTE from anon on internal helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid)                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid)                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.same_school(uuid)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_classroom_owner(uuid)                FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_classroom_member(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_classroom_co_teacher(uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_staff_id()                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_classroom_by_code(text)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_grade_for_school(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_to_super_admin(uuid)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_child_to_parent(text)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.unlink_child_from_parent(uuid)          FROM anon;

-- Permitted teachers previously had full FOR ALL rights (insert,
-- update, delete) on their own announcements. Per spec: a teacher who
-- can post may create and edit their own, but may NOT delete even
-- their own — only admin/principal can delete or archive any
-- announcement, regardless of who created it.

DROP POLICY IF EXISTS "Permitted teachers manage own announcements" ON public.school_announcements;

CREATE POLICY "Permitted teachers create announcements" ON public.school_announcements
FOR INSERT TO authenticated
WITH CHECK (
  same_school(school_id)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.school_id = school_announcements.school_id AND s.can_post_announcements
  )
);

CREATE POLICY "Permitted teachers edit own announcements" ON public.school_announcements
FOR UPDATE TO authenticated
USING (
  same_school(school_id)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.school_id = school_announcements.school_id AND s.can_post_announcements
  )
)
WITH CHECK (
  same_school(school_id)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.school_id = school_announcements.school_id AND s.can_post_announcements
  )
);

-- Deliberately no DELETE policy for teachers here — "Admins manage
-- announcements" (FOR ALL, admin/principal only) is the only policy
-- that covers DELETE now, which is exactly the intent: nobody but
-- admin/principal can delete or archive an announcement.

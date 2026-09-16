-- "Fill with picture" for a classroom banner, alongside the existing flat
-- banner_color swatch picker — a classroom's own teacher (not just
-- admin/principal) needs to be able to upload this, unlike school-assets
-- (logo/signature/stamp) which is intentionally admin/principal-only. A
-- separate bucket keeps that distinction clean instead of overloading
-- school-assets' existing admin-only policies.

ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS banner_image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('classroom-assets', 'classroom-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Classroom assets are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'classroom-assets');

-- Path convention: <classroom_id>/banner.<ext> — write access is the
-- classroom's own teacher, or an admin/principal of the same school.
CREATE POLICY "Classroom teacher or school admin uploads classroom assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'classroom-assets'
  AND EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.teacher_id = auth.uid()
        OR ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
            AND c.school_id = public.get_user_school_id(auth.uid()))
      )
  )
);

CREATE POLICY "Classroom teacher or school admin updates classroom assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'classroom-assets'
  AND EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.teacher_id = auth.uid()
        OR ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
            AND c.school_id = public.get_user_school_id(auth.uid()))
      )
  )
);

CREATE POLICY "Classroom teacher or school admin deletes classroom assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'classroom-assets'
  AND EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (
        c.teacher_id = auth.uid()
        OR ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
            AND c.school_id = public.get_user_school_id(auth.uid()))
      )
  )
);

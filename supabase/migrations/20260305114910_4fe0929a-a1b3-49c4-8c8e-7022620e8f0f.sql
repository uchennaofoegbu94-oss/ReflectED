-- Allow students to create attachment records for their own assignment submissions
DROP POLICY IF EXISTS "Students can add submission attachments" ON public.attachments;
CREATE POLICY "Students can add submission attachments"
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (
  submission_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.submissions sub
    JOIN public.students s ON s.id = sub.student_id
    WHERE sub.id = attachments.submission_id
      AND sub.assignment_id IS NOT NULL
      AND s.user_id = auth.uid()
  )
);

-- Allow students to upload/update/delete their own submission files in classroom-materials
DROP POLICY IF EXISTS "Students can upload submission materials" ON storage.objects;
CREATE POLICY "Students can upload submission materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'classroom-materials'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    JOIN public.classroom_members cm ON cm.classroom_id = a.classroom_id
    JOIN public.students s ON s.id = cm.student_id
    WHERE a.id::text = (storage.foldername(name))[2]
      AND COALESCE(a.is_deleted, false) = false
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Students can update own submission materials" ON storage.objects;
CREATE POLICY "Students can update own submission materials"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'classroom-materials'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'classroom-materials'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

DROP POLICY IF EXISTS "Students can delete own submission materials" ON storage.objects;
CREATE POLICY "Students can delete own submission materials"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'classroom-materials'
  AND (storage.foldername(name))[1] = 'submissions'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

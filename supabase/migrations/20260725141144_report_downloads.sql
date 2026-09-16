-- Tracks report card / transcript PDF downloads, per student, per school.
-- Backs the "Downloads" stat on the Results Management page, which was
-- previously a hardcoded 0 with nothing feeding it.

CREATE TABLE public.report_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'report_card' CHECK (document_type IN ('report_card', 'transcript')),
  downloaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view school downloads" ON public.report_downloads
FOR SELECT TO authenticated
USING (is_staff(auth.uid()) AND same_school(school_id));

-- Anyone who can already see the report card (staff, or the
-- student/parent themselves) can log that they downloaded it. Students
-- can only log their own; parents only their own children's — this
-- mirrors the read access useMyReportCard / useStudentReportCard
-- already rely on, so no new capability is being granted, just a
-- record of an action already permitted.
CREATE POLICY "Users log own downloads" ON public.report_downloads
FOR INSERT TO authenticated
WITH CHECK (
  same_school(school_id)
  AND (
    is_staff(auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.parent_id = auth.uid())
  )
);

CREATE INDEX idx_report_downloads_school ON public.report_downloads(school_id);

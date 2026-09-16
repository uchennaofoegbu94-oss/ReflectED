-- The auto-recompute trigger only fires on NEW score writes against a
-- grade-source field. Designating a field as the grade source for the
-- first time (via ManageReportCardVisibilityDialog) doesn't touch any
-- scores itself, so existing data already sitting in that field stayed
-- stale — this is what "position doesn't calculate correctly" was, for
-- students whose scores were entered before the field was marked as the
-- grade source. This function is called once, right after the
-- designation changes, to catch every class+term that already has data.
CREATE OR REPLACE FUNCTION public.recompute_transcripts_for_field(p_field_id uuid, p_generated_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT s.class_id, bfs.term_id
    FROM public.broadsheet_field_scores bfs
    JOIN public.students s ON s.id = bfs.student_id
    WHERE bfs.field_id = p_field_id AND bfs.score IS NOT NULL AND s.class_id IS NOT NULL
  LOOP
    PERFORM public.recompute_class_transcripts(r.class_id, r.term_id, p_generated_by);
  END LOOP;
END;
$$;

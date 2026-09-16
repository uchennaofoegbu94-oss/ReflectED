-- Two related fixes, both stemming from the same root cause: Report Card's
-- Grade badge and the whole Transcript pipeline (total/average/position)
-- were hardcoded to assessment_scores.total/grade — which is ONLY ever
-- populated when a school enters scores into the 4 legacy CA1-3/Exam
-- fields specifically. A school that has moved entirely to its own custom
-- Broadsheet fields (as in the reported screenshot) never touches those
-- legacy fields at all, so assessment_scores stays empty and Grade/
-- Total/Position all silently show nothing — not a bug in the display,
-- but in what it was reading from.
--
-- Fix: let a school designate ONE Broadsheet field as "this represents a
-- subject's final score" (is_grade_source). Everything downstream (Grade
-- badge, Transcript total/average/position) reads from THAT field's
-- broadsheet_field_scores when set, falling back to the legacy
-- assessment_scores path when it isn't — so schools on the old system
-- keep working exactly as before, and schools on the new one get correct
-- numbers everywhere.
--
-- Second fix: Transcript no longer needs a manual "Commit" click for
-- normal use — same principle as the Pre-CA -> Broadsheet auto-push:
-- whenever a grade-source field's score changes, the whole class's
-- transcript rows for that term recompute automatically (Commit to
-- Transcript stays available as a manual force-recompute, e.g. after
-- bulk data fixes).

ALTER TABLE public.broadsheet_fields
  ADD COLUMN IF NOT EXISTS is_grade_source boolean NOT NULL DEFAULT false;

-- Set-based, reusable by both the trigger and the manual "Commit to
-- Transcript" button (useCommitTranscripts can call this via RPC instead
-- of duplicating the logic in JS).
CREATE OR REPLACE FUNCTION public.recompute_class_transcripts(p_class_id uuid, p_term_id uuid, p_generated_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_grade_field_id uuid;
  v_school_id uuid;
BEGIN
  SELECT session_id INTO v_session_id FROM public.terms WHERE id = p_term_id;
  SELECT school_id INTO v_school_id FROM public.students WHERE class_id = p_class_id LIMIT 1;

  -- Prefer a school-designated grade-source Broadsheet field; NULL here
  -- (no field designated) means "fall back to legacy assessment_scores"
  -- entirely, handled by the COALESCE below.
  SELECT id INTO v_grade_field_id FROM public.broadsheet_fields
    WHERE school_id = v_school_id AND pipeline_stage = 'broadsheet' AND is_grade_source = true
    LIMIT 1;

  WITH active_students AS (
    SELECT id FROM public.students WHERE class_id = p_class_id AND enrollment_status = 'active'
  ),
  dynamic_scores AS (
    SELECT s.id AS student_id, bfs.subject_id, bfs.score
    FROM active_students s
    JOIN public.broadsheet_field_scores bfs
      ON bfs.student_id = s.id AND bfs.term_id = p_term_id AND bfs.field_id = v_grade_field_id
    WHERE v_grade_field_id IS NOT NULL AND bfs.score IS NOT NULL
  ),
  legacy_scores AS (
    SELECT s.id AS student_id, a.subject_id, a.total AS score
    FROM active_students s
    JOIN public.assessment_scores a ON a.student_id = s.id AND a.term_id = p_term_id
    WHERE v_grade_field_id IS NULL AND a.total IS NOT NULL
  ),
  combined AS (
    SELECT * FROM dynamic_scores
    UNION ALL
    SELECT * FROM legacy_scores
  ),
  per_student AS (
    SELECT
      s.id AS student_id,
      COUNT(c.subject_id) AS total_subjects,
      COALESCE(SUM(c.score), 0) AS total_score,
      CASE WHEN COUNT(c.subject_id) > 0
        THEN ROUND(COALESCE(SUM(c.score), 0) / COUNT(c.subject_id), 2)
        ELSE 0 END AS average_score
    FROM active_students s
    LEFT JOIN combined c ON c.student_id = s.id
    GROUP BY s.id
  ),
  ranked AS (
    SELECT *, RANK() OVER (ORDER BY average_score DESC) AS position
    FROM per_student
  )
  INSERT INTO public.result_transcripts
    (student_id, session_id, term_id, total_subjects, total_score, average_score, position, class_size, generated_by, generated_at)
  SELECT student_id, v_session_id, p_term_id, total_subjects, total_score, average_score, position,
    (SELECT count(*) FROM active_students), p_generated_by, now()
  FROM ranked
  ON CONFLICT (student_id, term_id) DO UPDATE SET
    total_subjects = EXCLUDED.total_subjects,
    total_score = EXCLUDED.total_score,
    average_score = EXCLUDED.average_score,
    position = EXCLUDED.position,
    class_size = EXCLUDED.class_size,
    generated_at = EXCLUDED.generated_at;
END;
$$;

-- Auto-recompute trigger: fires whenever ANY broadsheet_field_scores row
-- changes for a field flagged is_grade_source, recomputing the whole
-- class's transcript for that term — same "just like Excel" principle as
-- the Pre-CA -> Broadsheet auto-push. Deliberately scoped to only
-- grade-source field writes (not every field), since that's the only
-- data Transcript actually reads under the new dynamic path — this keeps
-- it from firing on every unrelated score entry.
CREATE OR REPLACE FUNCTION public.auto_recompute_transcript_on_score_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field RECORD;
  v_class_id uuid;
BEGIN
  SELECT * INTO v_field FROM public.broadsheet_fields WHERE id = NEW.field_id;
  IF NOT COALESCE(v_field.is_grade_source, false) THEN
    RETURN NEW;
  END IF;

  SELECT class_id INTO v_class_id FROM public.students WHERE id = NEW.student_id;
  IF v_class_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.recompute_class_transcripts(v_class_id, NEW.term_id, NEW.entered_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_recompute_transcript ON public.broadsheet_field_scores;
CREATE TRIGGER trg_auto_recompute_transcript
  AFTER INSERT OR UPDATE OF score ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.auto_recompute_transcript_on_score_change();

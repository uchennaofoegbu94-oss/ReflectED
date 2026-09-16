-- Results pipeline follow-up (item 3 of the deferred list): Final Total/
-- Average previously only reflected assessment_scores.total (the 4 legacy
-- CA fields, via the write-through trigger) — any additional custom
-- Broadsheet-stage field an admin created was invisible to it. This makes
-- the aggregation fully dynamic: sum every 'broadsheet'+'subject'-scope
-- field's score, per subject, then across subjects — whatever fields
-- actually exist, not a fixed set.

-- The actual computation, factored out so both the trigger below and the
-- one-time backfill at the bottom of this migration can call it.
CREATE OR REPLACE FUNCTION public.recompute_final_totals_for(_student_id uuid, _term_id uuid, _school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_field_id uuid;
  v_avg_field_id uuid;
  v_count integer;
  v_sum numeric;
  v_avg numeric;
BEGIN
  SELECT id INTO v_total_field_id FROM public.broadsheet_fields
    WHERE school_id = _school_id AND computation_key = 'final_total';
  SELECT id INTO v_avg_field_id FROM public.broadsheet_fields
    WHERE school_id = _school_id AND computation_key = 'final_average';

  IF v_total_field_id IS NULL OR v_avg_field_id IS NULL THEN
    RETURN;
  END IF;

  -- Per subject: sum of every Broadsheet subject-scope field's score
  -- (CA1+CA2+CA3+Exam+anything else an admin added). Across subjects:
  -- summed again for Final Total; count of distinct subjects with at
  -- least one such score is the divisor for Final Average — same
  -- denominator role the count of assessment_scores rows played before.
  SELECT COUNT(DISTINCT bfs.subject_id), COALESCE(SUM(bfs.score), 0)
    INTO v_count, v_sum
  FROM public.broadsheet_field_scores bfs
  JOIN public.broadsheet_fields bf ON bf.id = bfs.field_id
  WHERE bf.school_id = _school_id
    AND bf.pipeline_stage = 'broadsheet'
    AND bf.field_scope = 'subject'
    AND bfs.student_id = _student_id
    AND bfs.term_id = _term_id
    AND bfs.score IS NOT NULL;

  v_avg := CASE WHEN v_count > 0 THEN round(v_sum / v_count, 2) ELSE NULL END;

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES
    (v_total_field_id, _student_id, NULL, _term_id,
     CASE WHEN v_count > 0 THEN v_sum ELSE NULL END, 'system_final')
  ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();

  INSERT INTO public.broadsheet_field_scores
    (field_id, student_id, subject_id, term_id, score, source_type)
  VALUES
    (v_avg_field_id, _student_id, NULL, _term_id, v_avg, 'system_final')
  ON CONFLICT (field_id, student_id, term_id) WHERE subject_id IS NULL
  DO UPDATE SET score = EXCLUDED.score, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_final_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_term_id uuid;
  v_school_id uuid;
  v_field_stage text;
  v_field_scope text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    v_term_id := OLD.term_id;
  ELSE
    v_student_id := NEW.student_id;
    v_term_id := NEW.term_id;
  END IF;

  SELECT bf.school_id, bf.pipeline_stage, bf.field_scope
    INTO v_school_id, v_field_stage, v_field_scope
  FROM public.broadsheet_fields bf
  WHERE bf.id = COALESCE(NEW.field_id, OLD.field_id);

  -- Only a write to a Broadsheet-stage *subject*-scope field score should
  -- trigger a recompute. This also self-limits recursion:
  -- recompute_final_totals_for's own upsert writes the 'broadsheet'+
  -- 'final' Total/Average fields, which re-fires this trigger, but
  -- field_scope='final' hits this early return immediately — one extra
  -- no-op call, not a loop.
  IF v_school_id IS NULL OR v_field_stage IS DISTINCT FROM 'broadsheet' OR v_field_scope IS DISTINCT FROM 'subject' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.recompute_final_totals_for(v_student_id, v_term_id, v_school_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Retire the old assessment_scores-driven trigger — Final Total/Average
-- are now driven entirely from broadsheet_field_scores. The write-through
-- trigger (sync_legacy_ca_column) still keeps assessment_scores in sync
-- for report card/transcript rendering, it's just no longer what Final
-- Total sums.
DROP TRIGGER IF EXISTS trg_recompute_final_totals ON public.assessment_scores;

DROP TRIGGER IF EXISTS trg_recompute_final_totals_from_broadsheet ON public.broadsheet_field_scores;
CREATE TRIGGER trg_recompute_final_totals_from_broadsheet
  AFTER INSERT OR UPDATE OF score OR DELETE ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.recompute_final_totals();

-- One-time recompute for every existing student+term so Final Total/
-- Average reflect the new computation immediately, not just on the next
-- score write.
DO $$
DECLARE
  combo RECORD;
BEGIN
  FOR combo IN
    SELECT DISTINCT bfs.student_id, bfs.term_id, bf.school_id
    FROM public.broadsheet_field_scores bfs
    JOIN public.broadsheet_fields bf ON bf.id = bfs.field_id
    WHERE bf.pipeline_stage = 'broadsheet' AND bf.field_scope = 'subject'
  LOOP
    PERFORM public.recompute_final_totals_for(combo.student_id, combo.term_id, combo.school_id);
  END LOOP;
END $$;

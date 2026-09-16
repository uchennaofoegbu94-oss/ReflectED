-- Old #15: deleting a Pre-CA/Broadsheet field had no dependency check at
-- all (see the finding in the earlier plan message) — a field referenced
-- by a saved mapping preset (broadsheet_field_mappings.source_field_ids)
-- or another field's formula (formula_source_field_ids) could be deleted
-- with zero warning, leaving a silent dangling reference that just quietly
-- produced wrong/fewer results afterward.
--
-- Confirmed UX: don't block the delete outright — first show what's using
-- it, so the admin can choose to Archive instead or clean up the
-- references themselves. If they confirm anyway, cascade-clean: strip the
-- field's id out of every reference, delete it, and recompute every
-- computed field that lost a source so its stored value is never stale.

-- What's currently referencing a field — used to build the warning
-- message client-side before the confirm step.
CREATE OR REPLACE FUNCTION public.get_broadsheet_field_references(_field_id uuid)
RETURNS TABLE(mapping_names text[], computed_field_names text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT array_agg(name ORDER BY name) FROM public.broadsheet_field_mappings
      WHERE _field_id = ANY(source_field_ids)),
    (SELECT array_agg(name ORDER BY name) FROM public.broadsheet_fields
      WHERE is_computed = true AND _field_id = ANY(formula_source_field_ids) AND id != _field_id)
$$;

-- Recomputes one computed field's stored scores from scratch against
-- whatever sources it currently has (post-cleanup). Same aggregation
-- logic as recompute_computed_broadsheet_fields's trigger body, but
-- driven by an explicit call instead of a score write — needed because
-- editing a field's *formula* (removing a dangling source) doesn't itself
-- write any score row, so the existing trigger never fires for it and the
-- stored value would otherwise stay stale until some unrelated score
-- write happened to touch it later.
CREATE OR REPLACE FUNCTION public.recompute_field_now(_field_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  combo RECORD;
  v_all_present boolean;
  v_sum numeric;
  v_avg numeric;
  v_max numeric;
  v_min numeric;
  v_result numeric;
  v_has_sources boolean;
BEGIN
  SELECT * INTO dep FROM public.broadsheet_fields WHERE id = _field_id AND is_computed = true;
  IF dep.id IS NULL THEN
    RETURN;
  END IF;

  v_has_sources := dep.formula_source_field_ids IS NOT NULL AND array_length(dep.formula_source_field_ids, 1) > 0;

  FOR combo IN
    SELECT DISTINCT student_id, subject_id, term_id
    FROM public.broadsheet_field_scores
    WHERE field_id = dep.id
       OR (v_has_sources AND field_id = ANY(dep.formula_source_field_ids))
  LOOP
    IF v_has_sources THEN
      SELECT
        bool_and(bfs.score IS NOT NULL),
        sum(COALESCE(bfs.score, 0)),
        avg(COALESCE(bfs.score, 0)),
        max(COALESCE(bfs.score, 0)),
        min(COALESCE(bfs.score, 0))
      INTO v_all_present, v_sum, v_avg, v_max, v_min
      FROM unnest(dep.formula_source_field_ids) AS fid
      LEFT JOIN public.broadsheet_field_scores bfs
        ON bfs.field_id = fid
       AND bfs.student_id = combo.student_id
       AND bfs.subject_id = combo.subject_id
       AND bfs.term_id = combo.term_id;

      v_result := CASE dep.formula_operation
        WHEN 'sum' THEN v_sum
        WHEN 'average' THEN v_avg
        WHEN 'max' THEN v_max
        WHEN 'min' THEN v_min
      END;
    ELSE
      -- Every source this field had was removed — nothing left to
      -- compute. Blank (NULL), same "not final yet" convention as an
      -- incomplete source list, not an error.
      v_all_present := false;
      v_result := NULL;
    END IF;

    INSERT INTO public.broadsheet_field_scores
      (field_id, student_id, subject_id, term_id, score, source_type)
    VALUES
      (dep.id, combo.student_id, combo.subject_id, combo.term_id,
       CASE WHEN v_all_present THEN round(v_result, 2) ELSE NULL END,
       'computed')
    ON CONFLICT (field_id, student_id, subject_id, term_id)
    DO UPDATE SET score = EXCLUDED.score, updated_at = now();
  END LOOP;
END;
$$;

-- The confirmed-delete action itself. Same authorization shape as the
-- rest of the Pre-CA field management surface (same-school admin/
-- principal). The existing guard_system_broadsheet_field trigger still
-- blocks deleting either system Final field — that exception surfaces
-- through this function unchanged, nothing here weakens it.
CREATE OR REPLACE FUNCTION public.delete_broadsheet_field_cascade(_field_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_affected_ids uuid[];
  v_id uuid;
BEGIN
  SELECT school_id INTO v_school_id FROM public.broadsheet_fields WHERE id = _field_id;
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Field not found';
  END IF;

  IF NOT (
    public.same_school(v_school_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this field';
  END IF;

  -- Strip from every mapping preset that references it.
  UPDATE public.broadsheet_field_mappings
  SET source_field_ids = array_remove(source_field_ids, _field_id)
  WHERE _field_id = ANY(source_field_ids);

  -- Strip from every other field's formula, remembering which ones so
  -- they can be recomputed once the field itself is actually gone.
  SELECT array_agg(id) INTO v_affected_ids
  FROM public.broadsheet_fields
  WHERE is_computed = true AND _field_id = ANY(formula_source_field_ids) AND id != _field_id;

  IF v_affected_ids IS NOT NULL THEN
    UPDATE public.broadsheet_fields
    SET formula_source_field_ids = array_remove(formula_source_field_ids, _field_id)
    WHERE id = ANY(v_affected_ids);
  END IF;

  -- The field's own scores cascade away via the existing FK; the guard
  -- trigger still protects the two system fields.
  DELETE FROM public.broadsheet_fields WHERE id = _field_id;

  IF v_affected_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_affected_ids LOOP
      PERFORM public.recompute_field_now(v_id);
    END LOOP;
  END IF;
END;
$$;

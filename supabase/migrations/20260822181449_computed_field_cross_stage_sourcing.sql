-- A Broadsheet-stage computed field (e.g. "Total CA" = sum of CA1+CA2+
-- CA3+...) should be able to source Pre-CA fields directly, and a Report
-- Card-stage computed field should be able to source Broadsheet fields —
-- this is the formula-engine equivalent of "push as comprising elements"
-- one stage down, which the pipeline was always meant to support. The
-- recompute engine (recompute_computed_broadsheet_fields) already handles
-- this correctly with zero changes needed — it matches purely on
-- formula_source_field_ids regardless of stage. Only the save-time
-- validation here was wrongly restricting sources to the same stage.
--
-- Same-stage sourcing is still allowed too (e.g. a broadsheet "Total" =
-- "Total CA" + "Exam", both broadsheet fields) — this widens the rule
-- rather than replacing it.

CREATE OR REPLACE FUNCTION public.prevent_computed_field_cycles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle boolean;
  v_mismatch boolean;
  v_stage_rank int;
BEGIN
  IF NEW.is_computed IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.id = ANY(NEW.formula_source_field_ids) THEN
    RAISE EXCEPTION 'A computed field cannot reference itself';
  END IF;

  v_stage_rank := CASE NEW.pipeline_stage
    WHEN 'pre_ca' THEN 0 WHEN 'broadsheet' THEN 1 WHEN 'report_card' THEN 2 END;

  IF NEW.formula_source_field_ids IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.broadsheet_fields bf
      WHERE bf.id = ANY(NEW.formula_source_field_ids)
        AND (
          bf.field_scope IS DISTINCT FROM NEW.field_scope
          OR (CASE bf.pipeline_stage
                WHEN 'pre_ca' THEN 0 WHEN 'broadsheet' THEN 1 WHEN 'report_card' THEN 2 END
             ) NOT IN (v_stage_rank, v_stage_rank - 1)
        )
    ) INTO v_mismatch;

    IF v_mismatch THEN
      RAISE EXCEPTION 'A computed field can only source fields in the same scope, from its own pipeline stage or the one immediately before it';
    END IF;
  END IF;

  WITH RECURSIVE deps AS (
    SELECT unnest(NEW.formula_source_field_ids) AS field_id
    UNION
    SELECT unnest(bf.formula_source_field_ids)
    FROM public.broadsheet_fields bf
    JOIN deps d ON bf.id = d.field_id
    WHERE bf.is_computed = true AND bf.formula_source_field_ids IS NOT NULL
  )
  SELECT EXISTS(SELECT 1 FROM deps WHERE field_id = NEW.id) INTO v_cycle;

  IF v_cycle THEN
    RAISE EXCEPTION 'Circular reference detected: this formula would depend on itself through another computed field';
  END IF;

  RETURN NEW;
END;
$$;

-- Computed Pre-CA fields.
--
-- Until now, broadsheet_fields could only be scored manually or via a
-- push from an assignment/quiz. This adds a second kind of field:
-- one whose score is *derived* from other fields (e.g. "Total
-- Quizzes" = average of three quiz fields), recomputed automatically
-- whenever an input changes, and usable anywhere a normal field is —
-- including as the source for a commit-to-broadsheet mapping, so a
-- computed field can propagate straight through to CA1/CA2/CA3/Exam
-- exactly like a manually-scored one.
--
-- Scope note: this supports SUM / AVERAGE / MAX / MIN over a chosen
-- set of other fields — not arbitrary Excel-style expressions
-- (+, -, *, / between arbitrary cells). That covers every example in
-- the spec (subtotal/average of a group of scores) without the
-- security and complexity cost of evaluating arbitrary formula
-- strings server-side.

ALTER TABLE public.broadsheet_fields
  ADD COLUMN is_computed boolean NOT NULL DEFAULT false,
  ADD COLUMN formula_operation text CHECK (formula_operation IN ('sum', 'average', 'max', 'min')),
  ADD COLUMN formula_source_field_ids uuid[];

ALTER TABLE public.broadsheet_fields
  ADD CONSTRAINT chk_computed_field_formula CHECK (
    (is_computed = false AND formula_operation IS NULL AND formula_source_field_ids IS NULL)
    OR
    (is_computed = true AND formula_operation IS NOT NULL AND formula_source_field_ids IS NOT NULL)
  );

-- Prevents a computed field from (directly or transitively) depending
-- on itself, which would otherwise make the recompute trigger below
-- loop forever. Runs on every insert/update to broadsheet_fields, so
-- the "no cycles" invariant holds for all stored data at all times —
-- each check only needs to walk currently-stored (already-validated)
-- chains, not re-verify the whole table.
CREATE OR REPLACE FUNCTION public.prevent_computed_field_cycles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle boolean;
BEGIN
  IF NEW.is_computed IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.id = ANY(NEW.formula_source_field_ids) THEN
    RAISE EXCEPTION 'A computed field cannot reference itself';
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

DROP TRIGGER IF EXISTS trg_prevent_computed_field_cycles ON public.broadsheet_fields;
CREATE TRIGGER trg_prevent_computed_field_cycles
  BEFORE INSERT OR UPDATE ON public.broadsheet_fields
  FOR EACH ROW EXECUTE FUNCTION public.prevent_computed_field_cycles();

-- Blocks direct/manual writes to a computed field's score — its value
-- must only ever come from the recompute trigger below (source_type
-- = 'computed'). Without this, a manual push or a stray script could
-- silently overwrite a derived value.
CREATE OR REPLACE FUNCTION public.guard_computed_field_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_computed boolean;
BEGIN
  SELECT is_computed INTO v_is_computed FROM public.broadsheet_fields WHERE id = NEW.field_id;
  IF v_is_computed AND NEW.source_type IS DISTINCT FROM 'computed' THEN
    RAISE EXCEPTION 'This field is computed automatically and cannot be scored directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_computed_field_scores ON public.broadsheet_field_scores;
CREATE TRIGGER trg_guard_computed_field_scores
  BEFORE INSERT OR UPDATE ON public.broadsheet_field_scores
  FOR EACH ROW EXECUTE FUNCTION public.guard_computed_field_scores();

-- The recompute itself. Fires after any write to broadsheet_field_scores;
-- finds every computed field that lists the just-written field as one of
-- its sources, and recomputes+upserts that computed field's score for
-- the same student/subject/term.
--
-- Display-vs-propagation rule: if every source field has a real score,
-- the computed value is stored as-is. If any source is still unscored,
-- the stored value is NULL (renders blank in the Pre-CA grid — "not
-- final yet"), but any OTHER computed field that in turn depends on
-- this one treats that NULL as 0 (via COALESCE below), so an
-- incomplete input never blocks a downstream computation or a
-- broadsheet commit — it just yields a lower number until updated.
CREATE OR REPLACE FUNCTION public.recompute_computed_broadsheet_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dep RECORD;
  v_all_present boolean;
  v_sum numeric;
  v_avg numeric;
  v_max numeric;
  v_min numeric;
  v_result numeric;
BEGIN
  FOR dep IN
    SELECT * FROM public.broadsheet_fields
    WHERE is_computed = true
      AND NEW.field_id = ANY(formula_source_field_ids)
  LOOP
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
     AND bfs.student_id = NEW.student_id
     AND bfs.subject_id = NEW.subject_id
     AND bfs.term_id = NEW.term_id;

    v_result := CASE dep.formula_operation
      WHEN 'sum' THEN v_sum
      WHEN 'average' THEN v_avg
      WHEN 'max' THEN v_max
      WHEN 'min' THEN v_min
    END;

    INSERT INTO public.broadsheet_field_scores
      (field_id, student_id, subject_id, term_id, score, source_type)
    VALUES
      (dep.id, NEW.student_id, NEW.subject_id, NEW.term_id,
       CASE WHEN v_all_present THEN round(v_result, 2) ELSE NULL END,
       'computed')
    ON CONFLICT (field_id, student_id, subject_id, term_id)
    DO UPDATE SET score = EXCLUDED.score, updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_computed_fields ON public.broadsheet_field_scores;
CREATE TRIGGER trg_recompute_computed_fields
  AFTER INSERT OR UPDATE ON public.broadsheet_field_scores
  FOR EACH ROW
  WHEN (pg_trigger_depth() < 20)
  EXECUTE FUNCTION public.recompute_computed_broadsheet_fields();

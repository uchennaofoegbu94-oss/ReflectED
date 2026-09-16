-- Behavioral (affective + psychomotor) domain ratings for report cards.
-- Two new tables:
--   behavioral_traits — the list of things being rated (e.g.
--     "Punctuality", "Handling of Tools"), tagged by domain, school-
--     configurable like everything else admin-facing in this schema.
--   student_behavioral_ratings — one 1-5 rating per student, per term,
--     per trait.

CREATE TYPE public.behavioral_domain AS ENUM ('affective', 'psychomotor');

CREATE TABLE public.behavioral_traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  domain public.behavioral_domain NOT NULL,
  name text NOT NULL,
  trait_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, domain, name)
);

ALTER TABLE public.behavioral_traits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view school traits" ON public.behavioral_traits
FOR SELECT TO authenticated
USING (is_staff(auth.uid()) AND same_school(school_id));

CREATE POLICY "Admins manage traits" ON public.behavioral_traits
FOR ALL TO authenticated
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

-- Students/parents also need to read trait names to render a report
-- card's rating tables (labels like "Punctuality" alongside the score).
CREATE POLICY "Students view own school traits" ON public.behavioral_traits
FOR SELECT TO authenticated
USING (same_school(school_id) AND EXISTS (
  SELECT 1 FROM public.students s WHERE s.user_id = auth.uid() AND s.school_id = behavioral_traits.school_id
));

CREATE POLICY "Parents view own school traits" ON public.behavioral_traits
FOR SELECT TO authenticated
USING (same_school(school_id) AND EXISTS (
  SELECT 1 FROM public.students s WHERE s.parent_id = auth.uid() AND s.school_id = behavioral_traits.school_id
));

CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.behavioral_traits
  FOR EACH ROW EXECUTE FUNCTION public.autofill_school_id();

CREATE TABLE public.student_behavioral_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  trait_id uuid NOT NULL REFERENCES public.behavioral_traits(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, term_id, trait_id)
);

ALTER TABLE public.student_behavioral_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage ratings" ON public.student_behavioral_ratings
FOR ALL TO authenticated
USING (is_staff(auth.uid()) AND same_school(school_id))
WITH CHECK (is_staff(auth.uid()) AND same_school(school_id));

CREATE POLICY "Students view own ratings" ON public.student_behavioral_ratings
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));

CREATE POLICY "Parents view children ratings" ON public.student_behavioral_ratings
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.parent_id = auth.uid()));

CREATE INDEX idx_student_behavioral_ratings_lookup
  ON public.student_behavioral_ratings(student_id, term_id);

CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.student_behavioral_ratings
  FOR EACH ROW EXECUTE FUNCTION public.autofill_school_id();

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.student_behavioral_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seeds a school's default trait list on first use, matching a
-- standard Nigerian report card layout. Idempotent — safe to call
-- every time the ratings grid loads; only inserts what's missing.
-- Schools can rename/deactivate/add traits afterward via the admin
-- CRUD (behavioral_traits itself), this only provides a starting point.
CREATE OR REPLACE FUNCTION public.ensure_default_behavioral_traits(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is SECURITY DEFINER (it needs to write even for a
  -- school with zero existing rows, before any admin has touched this
  -- feature) which bypasses RLS entirely — so it must check
  -- authorization itself rather than relying on the table's policies.
  IF NOT (
    public.is_staff(auth.uid()) AND public.same_school(p_school_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to seed behavioral traits for this school';
  END IF;

  INSERT INTO public.behavioral_traits (school_id, domain, name, trait_order)
  VALUES
    (p_school_id, 'affective', 'Attentiveness', 1),
    (p_school_id, 'affective', 'Honesty', 2),
    (p_school_id, 'affective', 'Neatness', 3),
    (p_school_id, 'affective', 'Punctuality', 4),
    (p_school_id, 'affective', 'Self Control', 5),
    (p_school_id, 'affective', 'Sense of Responsibility', 6),
    (p_school_id, 'affective', 'Relationship with Others', 7),
    (p_school_id, 'psychomotor', 'Handling of Tools', 1),
    (p_school_id, 'psychomotor', 'Drawing/Painting', 2),
    (p_school_id, 'psychomotor', 'Handwriting', 3),
    (p_school_id, 'psychomotor', 'Public Speaking', 4),
    (p_school_id, 'psychomotor', 'Speech Fluency', 5),
    (p_school_id, 'psychomotor', 'Sports & Games', 6)
  ON CONFLICT (school_id, domain, name) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_default_behavioral_traits(uuid) TO authenticated;

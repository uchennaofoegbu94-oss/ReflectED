-- Table for admin-defined global broadsheet custom fields (e.g., "Week 1 Quiz", "Mid-term Assignment")
CREATE TABLE public.broadsheet_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  field_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Table to store scores pushed to custom fields
CREATE TABLE public.broadsheet_field_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid REFERENCES public.broadsheet_fields(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  term_id uuid REFERENCES public.terms(id) ON DELETE CASCADE NOT NULL,
  score numeric,
  source_type text, -- 'assignment', 'quiz', 'manual'
  source_id uuid, -- assignment_id or quiz_id
  entered_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(field_id, student_id, subject_id, term_id)
);

-- Enable RLS
ALTER TABLE public.broadsheet_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadsheet_field_scores ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadsheet_fields
CREATE POLICY "Admins manage broadsheet fields"
ON public.broadsheet_fields FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role));

CREATE POLICY "Staff view broadsheet fields"
ON public.broadsheet_fields FOR SELECT
USING (is_staff(auth.uid()));

-- RLS policies for broadsheet_field_scores
CREATE POLICY "Staff manage field scores"
ON public.broadsheet_field_scores FOR ALL
USING (is_staff(auth.uid()));

CREATE POLICY "Students view own field scores"
ON public.broadsheet_field_scores FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students s
  WHERE s.id = broadsheet_field_scores.student_id AND s.user_id = auth.uid()
));

CREATE POLICY "Parents view children field scores"
ON public.broadsheet_field_scores FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students s
  WHERE s.id = broadsheet_field_scores.student_id AND s.parent_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_broadsheet_fields_updated_at
BEFORE UPDATE ON public.broadsheet_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broadsheet_field_scores_updated_at
BEFORE UPDATE ON public.broadsheet_field_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
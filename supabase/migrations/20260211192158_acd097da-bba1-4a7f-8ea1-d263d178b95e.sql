-- Create grading scales table
CREATE TABLE IF NOT EXISTS public.grading_scales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grade TEXT NOT NULL,
  min_score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  remark TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins manage grading scales"
ON public.grading_scales
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role));

CREATE POLICY "Grading scales viewable by authenticated"
ON public.grading_scales
FOR SELECT
USING (true);

-- Insert default grading scales
INSERT INTO public.grading_scales (grade, min_score, max_score, remark) VALUES
  ('A', 70, 100, 'Excellent'),
  ('B', 60, 69, 'Very Good'),
  ('C', 50, 59, 'Good'),
  ('D', 40, 49, 'Fair'),
  ('F', 0, 39, 'Poor')
ON CONFLICT DO NOTHING;
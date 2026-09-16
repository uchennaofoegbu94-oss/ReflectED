-- Create timetable_slots table for storing class schedules
CREATE TABLE public.timetable_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.class_arms(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 5), -- 1=Monday, 5=Friday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_number TEXT,
  term_id UUID REFERENCES public.terms(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create unique constraint to prevent double-booking
CREATE UNIQUE INDEX unique_class_slot ON public.timetable_slots (class_id, day_of_week, start_time) WHERE is_active = true;
CREATE UNIQUE INDEX unique_teacher_slot ON public.timetable_slots (teacher_id, day_of_week, start_time) WHERE is_active = true AND teacher_id IS NOT NULL;

-- Create index for faster lookups
CREATE INDEX idx_timetable_class ON public.timetable_slots (class_id);
CREATE INDEX idx_timetable_teacher ON public.timetable_slots (teacher_id);
CREATE INDEX idx_timetable_day ON public.timetable_slots (day_of_week);

-- Enable RLS
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Timetable viewable by authenticated" 
ON public.timetable_slots 
FOR SELECT 
USING (true);

CREATE POLICY "Admins manage timetable" 
ON public.timetable_slots 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_timetable_slots_updated_at
BEFORE UPDATE ON public.timetable_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  type TEXT NOT NULL DEFAULT 'event',
  coordinator_id UUID NOT NULL,
  created_by UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_participants table (for students)
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, student_id)
);

-- Create event_supporters table (for parents/guardians)
CREATE TABLE public.event_supporters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  support_type TEXT,
  notes TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_supporters ENABLE ROW LEVEL SECURITY;

-- Events policies
-- Everyone can view active events
CREATE POLICY "Events viewable by authenticated"
ON public.events
FOR SELECT
USING (is_active = true);

-- Admins/principals can do everything
CREATE POLICY "Admins manage all events"
ON public.events
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

-- Coordinators can update/delete their own events
CREATE POLICY "Coordinators manage own events"
ON public.events
FOR UPDATE
USING (coordinator_id = auth.uid());

CREATE POLICY "Coordinators delete own events"
ON public.events
FOR DELETE
USING (coordinator_id = auth.uid());

-- Staff can create events
CREATE POLICY "Staff create events"
ON public.events
FOR INSERT
WITH CHECK (is_staff(auth.uid()));

-- Event participants policies
CREATE POLICY "View event participants"
ON public.event_participants
FOR SELECT
USING (true);

-- Students can participate
CREATE POLICY "Students join events"
ON public.event_participants
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = event_participants.student_id
  AND s.user_id = auth.uid()
));

-- Students can leave events
CREATE POLICY "Students leave events"
ON public.event_participants
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = event_participants.student_id
  AND s.user_id = auth.uid()
));

-- Staff/coordinators manage participants
CREATE POLICY "Staff manage participants"
ON public.event_participants
FOR ALL
USING (is_staff(auth.uid()));

-- Event supporters policies
CREATE POLICY "View event supporters"
ON public.event_supporters
FOR SELECT
USING (true);

-- Parents can support events
CREATE POLICY "Parents support events"
ON public.event_supporters
FOR INSERT
WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'parent'));

-- Parents can remove their support
CREATE POLICY "Parents remove support"
ON public.event_supporters
FOR DELETE
USING (user_id = auth.uid());

-- Staff/coordinators manage supporters
CREATE POLICY "Staff manage supporters"
ON public.event_supporters
FOR ALL
USING (is_staff(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert mock events as live data
INSERT INTO public.events (title, description, event_date, event_time, location, type, coordinator_id, created_by)
SELECT 
  'End of Term Exams',
  'Final examinations for all students',
  '2025-03-25'::date,
  '08:00'::time,
  'All Classrooms',
  'exam',
  (SELECT id FROM public.staff LIMIT 1),
  (SELECT user_id FROM public.staff LIMIT 1)
WHERE EXISTS (SELECT 1 FROM public.staff);

INSERT INTO public.events (title, description, event_date, event_time, location, type, coordinator_id, created_by)
SELECT 
  'PTA Meeting',
  'Parent-Teacher Association quarterly meeting',
  '2025-03-20'::date,
  '14:00'::time,
  'School Hall',
  'meeting',
  (SELECT id FROM public.staff LIMIT 1),
  (SELECT user_id FROM public.staff LIMIT 1)
WHERE EXISTS (SELECT 1 FROM public.staff);

INSERT INTO public.events (title, description, event_date, event_time, location, type, coordinator_id, created_by)
SELECT 
  'Inter-House Sports',
  'Annual inter-house sports competition',
  '2025-03-28'::date,
  '09:00'::time,
  'Sports Field',
  'event',
  (SELECT id FROM public.staff LIMIT 1),
  (SELECT user_id FROM public.staff LIMIT 1)
WHERE EXISTS (SELECT 1 FROM public.staff);
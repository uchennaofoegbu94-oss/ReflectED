-- Add co-teachers table for classroom collaboration
CREATE TABLE public.classroom_co_teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  added_by UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(classroom_id, teacher_id)
);

-- Add syllabus table for classroom syllabi/scheme of work
CREATE TABLE public.classroom_syllabus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  week_number INTEGER,
  topic TEXT,
  objectives TEXT,
  activities TEXT,
  resources TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add live class sessions table
CREATE TABLE public.live_class_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  meeting_link TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.classroom_co_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_sessions ENABLE ROW LEVEL SECURITY;

-- RLS for co-teachers
CREATE POLICY "Teachers manage co-teachers"
ON public.classroom_co_teachers
FOR ALL
USING (
  EXISTS (SELECT 1 FROM classrooms c WHERE c.id = classroom_co_teachers.classroom_id AND c.teacher_id = auth.uid())
  OR is_staff(auth.uid())
);

CREATE POLICY "View co-teachers"
ON public.classroom_co_teachers
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM classrooms c WHERE c.id = classroom_co_teachers.classroom_id AND (c.teacher_id = auth.uid() OR teacher_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM classroom_members cm JOIN students s ON cm.student_id = s.id WHERE cm.classroom_id = classroom_co_teachers.classroom_id AND s.user_id = auth.uid())
  OR is_staff(auth.uid())
);

-- RLS for syllabus
CREATE POLICY "Teachers manage syllabus"
ON public.classroom_syllabus
FOR ALL
USING (
  EXISTS (SELECT 1 FROM classrooms c WHERE c.id = classroom_syllabus.classroom_id AND c.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM classroom_co_teachers ct WHERE ct.classroom_id = classroom_syllabus.classroom_id AND ct.teacher_id = auth.uid())
  OR is_staff(auth.uid())
);

CREATE POLICY "View syllabus"
ON public.classroom_syllabus
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM classrooms c WHERE c.id = classroom_syllabus.classroom_id)
);

-- RLS for live sessions
CREATE POLICY "Teachers manage live sessions"
ON public.live_class_sessions
FOR ALL
USING (
  EXISTS (SELECT 1 FROM classrooms c WHERE c.id = live_class_sessions.classroom_id AND c.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM classroom_co_teachers ct WHERE ct.classroom_id = live_class_sessions.classroom_id AND ct.teacher_id = auth.uid())
  OR is_staff(auth.uid())
);

CREATE POLICY "View live sessions"
ON public.live_class_sessions
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM classrooms c WHERE c.id = live_class_sessions.classroom_id AND c.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM classroom_co_teachers ct WHERE ct.classroom_id = live_class_sessions.classroom_id AND ct.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM classroom_members cm JOIN students s ON cm.student_id = s.id WHERE cm.classroom_id = live_class_sessions.classroom_id AND s.user_id = auth.uid())
  OR is_staff(auth.uid())
);

-- Add trigger for updated_at
CREATE TRIGGER update_classroom_syllabus_updated_at
BEFORE UPDATE ON public.classroom_syllabus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_live_class_sessions_updated_at
BEFORE UPDATE ON public.live_class_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
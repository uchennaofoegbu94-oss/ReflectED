-- Create staff table for teacher/admin records
CREATE TABLE public.staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  employee_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  date_of_birth DATE,
  avatar_url TEXT,
  qualification TEXT,
  employment_date DATE DEFAULT CURRENT_DATE,
  employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'on_leave', 'resigned', 'terminated')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create special_roles enum
CREATE TYPE public.special_role_type AS ENUM (
  'form_teacher', 'games_master', 'dean_of_studies', 'head_of_department',
  'exam_officer', 'guidance_counselor', 'librarian', 'ict_coordinator',
  'head_prefect', 'assistant_head_prefect', 'class_prefect', 'sports_prefect',
  'library_prefect', 'health_prefect', 'social_prefect', 'labour_prefect'
);

-- Create special_roles table for both staff and students
CREATE TABLE public.special_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_type special_role_type NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.class_arms(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  CONSTRAINT valid_assignment CHECK (
    (staff_id IS NOT NULL AND student_id IS NULL) OR 
    (staff_id IS NULL AND student_id IS NOT NULL)
  )
);

-- Create messages table for communication
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_broadcast BOOLEAN DEFAULT false,
  target_roles TEXT[], -- Array of roles to target for broadcasts
  parent_id UUID REFERENCES public.messages(id) ON DELETE CASCADE, -- For replies
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create message_recipients table
CREATE TABLE public.message_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;

-- Staff policies
CREATE POLICY "Staff viewable by authenticated" ON public.staff
FOR SELECT USING (true);

CREATE POLICY "Admins manage staff" ON public.staff
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

-- Special roles policies
CREATE POLICY "Special roles viewable by authenticated" ON public.special_roles
FOR SELECT USING (true);

CREATE POLICY "Admins manage special roles" ON public.special_roles
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

-- Messages policies
CREATE POLICY "Users view own sent messages" ON public.messages
FOR SELECT USING (sender_id = auth.uid());

CREATE POLICY "Staff view broadcast messages" ON public.messages
FOR SELECT USING (is_broadcast = true AND is_staff(auth.uid()));

CREATE POLICY "Authenticated users create messages" ON public.messages
FOR INSERT WITH CHECK (sender_id = auth.uid() AND is_staff(auth.uid()));

CREATE POLICY "Senders update own messages" ON public.messages
FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Senders delete own messages" ON public.messages
FOR DELETE USING (sender_id = auth.uid());

-- Message recipients policies
CREATE POLICY "Recipients view own messages" ON public.message_recipients
FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Recipients update own read status" ON public.message_recipients
FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "Staff create recipients" ON public.message_recipients
FOR INSERT WITH CHECK (is_staff(auth.uid()));

-- Create indexes
CREATE INDEX idx_staff_user_id ON public.staff(user_id);
CREATE INDEX idx_special_roles_staff ON public.special_roles(staff_id);
CREATE INDEX idx_special_roles_student ON public.special_roles(student_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_message_recipients_recipient ON public.message_recipients(recipient_id);
CREATE INDEX idx_message_recipients_message ON public.message_recipients(message_id);

-- Create triggers for updated_at
CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
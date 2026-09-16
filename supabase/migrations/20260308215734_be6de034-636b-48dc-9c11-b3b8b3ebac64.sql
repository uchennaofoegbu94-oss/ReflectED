
-- School expenses table
CREATE TABLE public.school_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT 'general',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_to text,
  receipt_number text,
  notes text,
  recorded_by uuid,
  approved_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage expenses" ON public.school_expenses
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal') OR has_role(auth.uid(), 'accountant'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal') OR has_role(auth.uid(), 'accountant'));

CREATE POLICY "Staff view expenses" ON public.school_expenses
FOR SELECT TO authenticated
USING (is_staff(auth.uid()));

-- Audit log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log" ON public.audit_log
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

CREATE POLICY "System inserts audit log" ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (true);

-- Parent notification preferences - notify on child events
CREATE TABLE public.parent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  message text NOT NULL,
  reference_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own notifications" ON public.parent_notifications
FOR SELECT TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Parents update own notifications" ON public.parent_notifications
FOR UPDATE TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "System creates parent notifications" ON public.parent_notifications
FOR INSERT TO authenticated
WITH CHECK (true);

-- Function to notify parent when child joins/leaves event
CREATE OR REPLACE FUNCTION public.notify_parent_on_event_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_student record;
  v_event record;
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'joined';
    SELECT * INTO v_student FROM public.students WHERE id = NEW.student_id;
    SELECT * INTO v_event FROM public.events WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'left';
    SELECT * INTO v_student FROM public.students WHERE id = OLD.student_id;
    SELECT * INTO v_event FROM public.events WHERE id = OLD.event_id;
  END IF;

  IF v_student.parent_id IS NOT NULL AND v_event.id IS NOT NULL THEN
    INSERT INTO public.parent_notifications (parent_id, child_id, notification_type, message, reference_id)
    VALUES (
      v_student.parent_id,
      v_student.id,
      'event_participation',
      v_student.first_name || ' ' || v_student.last_name || ' has ' || v_action || ' the event: ' || v_event.title,
      v_event.id
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_parent_event_join
AFTER INSERT ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_parent_on_event_participation();

CREATE TRIGGER trg_notify_parent_event_leave
AFTER DELETE ON public.event_participants
FOR EACH ROW EXECUTE FUNCTION public.notify_parent_on_event_participation();

-- Allow students to update their own avatar
CREATE POLICY "Students update own avatar" ON public.students
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

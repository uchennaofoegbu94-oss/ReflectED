
-- School settings table for proctor mode and other config
CREATE TABLE IF NOT EXISTS public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT 'false'::jsonb,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view settings" ON public.school_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage settings" ON public.school_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

-- Insert default proctor setting
INSERT INTO public.school_settings (key, value) VALUES ('proctor_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Staff clock-in/out table
CREATE TABLE IF NOT EXISTS public.staff_clock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  date date NOT NULL DEFAULT CURRENT_DATE,
  method text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.staff_clock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own clock records" ON public.staff_clock_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.id = staff_clock_records.staff_id AND s.user_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Staff manage own clock records" ON public.staff_clock_records
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff s WHERE s.id = staff_clock_records.staff_id AND s.user_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Staff update own clock records" ON public.staff_clock_records
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff s WHERE s.id = staff_clock_records.staff_id AND s.user_id = auth.uid())
    OR is_staff(auth.uid())
  );

-- Attendance parameters table
CREATE TABLE IF NOT EXISTS public.attendance_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  late_after_minutes int NOT NULL DEFAULT 30,
  excused_reasons jsonb DEFAULT '["Medical", "Family Emergency", "Religious Holiday", "School Event", "Other"]'::jsonb,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendance_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View attendance params" ON public.attendance_parameters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage attendance params" ON public.attendance_parameters
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

INSERT INTO public.attendance_parameters (late_after_minutes) VALUES (30)
ON CONFLICT DO NOTHING;

-- Allow system role defs full CRUD for admin/principal  
DROP POLICY IF EXISTS "Admins manage role_definitions" ON public.role_definitions;
CREATE POLICY "Admins manage role_definitions" ON public.role_definitions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'));

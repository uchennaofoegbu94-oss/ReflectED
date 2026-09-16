
-- Phase 4a: Attendance sessions with submission lock + audit trail

-- 1. Sessions table groups attendance records per class/date/period
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.class_arms(id) ON DELETE SET NULL,
  date date NOT NULL,
  period integer,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','submitted','locked')),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_unique
  ON public.attendance_sessions (school_id, class_id, date, COALESCE(period, -1));
CREATE INDEX IF NOT EXISTS attendance_sessions_school_date_idx
  ON public.attendance_sessions (school_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions TO authenticated;
GRANT ALL ON public.attendance_sessions TO service_role;

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view school attendance sessions"
  ON public.attendance_sessions FOR SELECT
  USING (public.is_staff(auth.uid()) AND public.same_school(school_id));

CREATE POLICY "Staff create attendance sessions"
  ON public.attendance_sessions FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()) AND public.same_school(school_id));

-- Teachers can update only while open; admin/principal can always update (overrides)
CREATE POLICY "Staff update attendance sessions"
  ON public.attendance_sessions FOR UPDATE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
      OR (public.is_staff(auth.uid()) AND status = 'open')
    )
  )
  WITH CHECK (public.same_school(school_id));

CREATE POLICY "Admins delete attendance sessions"
  ON public.attendance_sessions FOR DELETE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
    )
  );

CREATE TRIGGER attendance_sessions_set_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Link records to session
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.attendance_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS attendance_records_session_idx ON public.attendance_records (session_id);

-- 3. Helper: is the session for a given record currently locked?
CREATE OR REPLACE FUNCTION public.attendance_session_locked(_session_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT status IN ('submitted','locked') FROM public.attendance_sessions WHERE id = _session_id),
    false
  );
$$;

-- 4. Tighten attendance_records policies: block teacher edits once locked, allow admin/principal
DROP POLICY IF EXISTS "Staff manage school attendance" ON public.attendance_records;

CREATE POLICY "Staff insert school attendance"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    public.is_staff(auth.uid()) AND public.same_school(school_id)
    AND (
      session_id IS NULL
      OR NOT public.attendance_session_locked(session_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
    )
  );

CREATE POLICY "Staff update school attendance"
  ON public.attendance_records FOR UPDATE
  USING (
    public.is_staff(auth.uid()) AND public.same_school(school_id)
    AND (
      session_id IS NULL
      OR NOT public.attendance_session_locked(session_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
    )
  )
  WITH CHECK (public.same_school(school_id));

CREATE POLICY "Staff delete school attendance"
  ON public.attendance_records FOR DELETE
  USING (
    public.is_staff(auth.uid()) AND public.same_school(school_id)
    AND (
      session_id IS NULL
      OR NOT public.attendance_session_locked(session_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
    )
  );

-- 5. Audit trail
CREATE TABLE IF NOT EXISTS public.attendance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  record_id uuid,
  session_id uuid,
  student_id uuid,
  action text NOT NULL CHECK (action IN ('insert','update','delete','submit','lock','unlock','override')),
  old_value jsonb,
  new_value jsonb,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_audit_school_idx ON public.attendance_audit (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_audit_session_idx ON public.attendance_audit (session_id);

GRANT SELECT, INSERT ON public.attendance_audit TO authenticated;
GRANT ALL ON public.attendance_audit TO service_role;

ALTER TABLE public.attendance_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read attendance audit"
  ON public.attendance_audit FOR SELECT
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
    )
  );

CREATE POLICY "System insert attendance audit"
  ON public.attendance_audit FOR INSERT
  WITH CHECK (public.same_school(school_id));

-- 6. Audit trigger on attendance_records: logs every change, marks as override if session locked
CREATE OR REPLACE FUNCTION public.log_attendance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_locked boolean := false;
  v_session uuid;
  v_school uuid;
  v_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_session := OLD.session_id; v_school := OLD.school_id;
  ELSE
    v_session := NEW.session_id; v_school := NEW.school_id;
  END IF;

  IF v_session IS NOT NULL THEN
    v_locked := public.attendance_session_locked(v_session);
  END IF;

  v_action := CASE
    WHEN v_locked AND TG_OP <> 'INSERT' THEN 'override'
    WHEN TG_OP = 'INSERT' THEN 'insert'
    WHEN TG_OP = 'UPDATE' THEN 'update'
    ELSE 'delete'
  END;

  INSERT INTO public.attendance_audit
    (school_id, record_id, session_id, student_id, action, old_value, new_value, performed_by)
  VALUES (
    v_school,
    COALESCE(NEW.id, OLD.id),
    v_session,
    COALESCE(NEW.student_id, OLD.student_id),
    v_action,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_records_audit ON public.attendance_records;
CREATE TRIGGER attendance_records_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.log_attendance_change();

-- 7. Session status-change audit
CREATE OR REPLACE FUNCTION public.log_attendance_session_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_action text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action := CASE NEW.status
      WHEN 'submitted' THEN 'submit'
      WHEN 'locked' THEN 'lock'
      WHEN 'open' THEN 'unlock'
      ELSE 'update'
    END;
    INSERT INTO public.attendance_audit
      (school_id, session_id, action, old_value, new_value, performed_by)
    VALUES (NEW.school_id, NEW.id, v_action, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_sessions_audit ON public.attendance_sessions;
CREATE TRIGGER attendance_sessions_audit
  AFTER UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_attendance_session_change();

-- Batch 7 (#11): role-scoped permissions
--
-- Recorded requirements: (1) a generalized permission system — discrete
-- capabilities grantable to a staff member independent of their base role,
-- (2) a grant applies platform-wide within that school (not scoped to one
-- class/instance), (3) can grant to multiple staff at once, (4) grants/revokes
-- are audit-logged.
--
-- Launch catalog (more can be added the same way later — just extend the enum
-- and add the matching "OR has_permission(...)" clause wherever needed):
--   manage_staff, manage_announcements, manage_fees, view_audit_log,
--   manage_school_settings, generate_reports, unlock_attendance,
--   manage_special_roles

CREATE TYPE public.permission_key AS ENUM (
  'manage_staff',
  'manage_announcements',
  'manage_fees',
  'view_audit_log',
  'manage_school_settings',
  'generate_reports',
  'unlock_attendance',
  'manage_special_roles'
);

CREATE TABLE public.permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  permission permission_key NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, permission)
);
ALTER TABLE public.permission_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage school permission grants"
  ON public.permission_grants FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')) AND public.same_school(school_id))
  WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')) AND public.same_school(school_id));

-- A staff member can see their own grants (needed client-side to know which
-- nav items/actions to show them).
CREATE POLICY "Staff view own permission grants"
  ON public.permission_grants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission permission_key)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permission_grants pg
    JOIN public.staff s ON s.id = pg.staff_id
    WHERE s.user_id = _user_id AND pg.permission = _permission
  )
$$;

-- ============================================================
-- Wire the launch catalog into existing admin/principal-only policies.
-- Each gets "OR (has_permission(auth.uid(), 'x') AND same_school(...))" added
-- alongside the existing admin/principal check — nothing already-working is
-- removed, this only adds an additional way in.
-- ============================================================

-- manage_special_roles
DROP POLICY IF EXISTS "Admins manage school special roles" ON public.special_roles;
CREATE POLICY "Admins and permitted staff manage special roles" ON public.special_roles FOR ALL TO authenticated
  USING (
    ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role))
      OR public.has_permission(auth.uid(), 'manage_special_roles'))
    AND same_school(school_id)
  )
  WITH CHECK (
    ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role))
      OR public.has_permission(auth.uid(), 'manage_special_roles'))
    AND same_school(school_id)
  );

-- manage_fees
DROP POLICY IF EXISTS "Admins manage student fees" ON public.student_fees;
CREATE POLICY "Admins and permitted staff manage student fees" ON public.student_fees
  FOR ALL TO authenticated
  USING (
    ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) OR public.has_permission(auth.uid(), 'manage_fees'))
    AND same_school(school_id)
  )
  WITH CHECK (
    ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) OR public.has_permission(auth.uid(), 'manage_fees'))
    AND same_school(school_id)
  );

-- manage_announcements
DROP POLICY IF EXISTS "Admins manage announcements" ON public.school_announcements;
CREATE POLICY "Admins and permitted staff manage announcements" ON public.school_announcements
  FOR ALL TO authenticated
  USING (
    same_school(school_id)
    AND ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) OR public.has_permission(auth.uid(), 'manage_announcements'))
  )
  WITH CHECK (
    same_school(school_id)
    AND ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) OR public.has_permission(auth.uid(), 'manage_announcements'))
  );

-- view_audit_log (adds to the SELECT policy fixed in the earlier audit_log migration)
DROP POLICY IF EXISTS "Admins view own school audit log" ON public.audit_log;
CREATE POLICY "Admins and permitted staff view own school audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')) OR public.has_permission(auth.uid(), 'view_audit_log'))
    AND public.same_school(school_id)
  );

-- manage_school_settings
DROP POLICY IF EXISTS "Admins manage school settings" ON public.school_settings;
CREATE POLICY "Admins and permitted staff manage school settings" ON public.school_settings FOR ALL TO authenticated
  USING (
    ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) OR public.has_permission(auth.uid(), 'manage_school_settings'))
    AND same_school(school_id)
  )
  WITH CHECK (
    ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) OR public.has_permission(auth.uid(), 'manage_school_settings'))
    AND same_school(school_id)
  );

-- unlock_attendance — widen the "locked session" branch of the update policy
-- (the open-session/form-teacher branch is untouched).
DROP POLICY IF EXISTS "Form teachers and admins update attendance sessions" ON public.attendance_sessions;
CREATE POLICY "Form teachers, admins and permitted staff update attendance sessions"
  ON public.attendance_sessions FOR UPDATE
  USING (
    public.same_school(school_id) AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR public.has_permission(auth.uid(), 'unlock_attendance')
      OR (
        public.has_role(auth.uid(), 'teacher') AND status = 'open'
        AND class_id IS NOT NULL AND public.is_form_teacher_of_class(class_id)
      )
    )
  )
  WITH CHECK (public.same_school(school_id));

-- generate_reports and manage_staff have no dedicated RLS to widen (Reports.tsx
-- reads through already-scoped hooks; staff invitation is enforced in the
-- invite-staff-member edge function) — those two are wired at the UI/edge
-- function layer instead, alongside this migration.

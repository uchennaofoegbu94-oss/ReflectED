
-- Support tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  category text DEFAULT 'general',
  assigned_to uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all tickets"
  ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School admins view own school tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (public.same_school(school_id));

CREATE POLICY "School admins create tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND public.same_school(school_id));

CREATE POLICY "School admins update own tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND public.same_school(school_id));

-- Feature flags per school
CREATE TABLE public.school_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  module_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, module_name)
);

ALTER TABLE public.school_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage feature flags"
  ON public.school_feature_flags FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "School users view own flags"
  ON public.school_feature_flags FOR SELECT TO authenticated
  USING (public.same_school(school_id));

-- Login history
CREATE TABLE public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  login_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all login history"
  ON public.login_history FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users view own login history"
  ON public.login_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System inserts login history"
  ON public.login_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Platform announcements
CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  announcement_type text NOT NULL DEFAULT 'notice',
  priority text NOT NULL DEFAULT 'normal',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage announcements"
  ON public.platform_announcements FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "All users view active announcements"
  ON public.platform_announcements FOR SELECT TO authenticated
  USING (is_active = true);

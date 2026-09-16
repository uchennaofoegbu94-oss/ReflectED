-- Two independent additions for the super-admin rebuild:
--
-- 1. Subscription tier/status tracking — scaffolding for the upcoming
--    pricing-tier system, NOT a full billing/payment engine (there's no
--    pricing or invoicing here, just "what tier/status is this school
--    on", settable by a super admin now, extensible later). Deliberately
--    a SEPARATE table from `schools` rather than new columns on it:
--    schools already has a broad admin/principal-editable UPDATE policy
--    (see 20260809145927_fix_schools_update_rls.sql) with no column-level
--    restriction, so a billing-relevant field living directly on that row
--    would be settable by a school's own admin via a raw API call, not
--    just through the app UI. A separate table with its own
--    super-admin-only write policy avoids that entirely.
--
-- 2. platform_settings — a singleton row backing the "no control
--    switches anywhere" gap: maintenance mode and whether self-service
--    school signup is currently open. Read by anyone (the signup page
--    and a maintenance banner need to check it while logged out), write
--    restricted to super admins.

CREATE TYPE public.subscription_tier AS ENUM ('trial', 'basic', 'pro', 'enterprise');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

CREATE TABLE public.school_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  tier public.subscription_tier NOT NULL DEFAULT 'trial',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own school or super admin views subscription"
  ON public.school_subscriptions FOR SELECT TO authenticated
  USING (
    public.same_school(school_id)
    OR EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid())
  );

CREATE POLICY "Only super admin manages subscriptions"
  ON public.school_subscriptions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

-- One row per existing school, defaulted to trial — so every school has
-- a row to display/edit from day one instead of the UI having to handle
-- a "no subscription row yet" case everywhere.
INSERT INTO public.school_subscriptions (school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

-- Keep new schools covered automatically going forward.
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.school_subscriptions (school_id) VALUES (NEW.id)
  ON CONFLICT (school_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_subscription ON public.schools;
CREATE TRIGGER trg_create_default_subscription
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription();

-- Audit this table too, same generic trigger from the audit-logging
-- migration — tier changes are exactly the kind of platform-operator
-- action that should be traceable.
DROP TRIGGER IF EXISTS trg_audit_school_subscriptions ON public.school_subscriptions;
CREATE TRIGGER trg_audit_school_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.school_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ── platform_settings ──────────────────────────────────────────────
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true), -- enforces a single row
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text,
  self_service_signup_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.platform_settings (id) VALUES (true);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including logged-out visitors hitting the public signup page)
-- needs to read this to know whether signup is open / a maintenance
-- banner should show.
CREATE POLICY "Anyone reads platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Only super admin updates platform settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid()));

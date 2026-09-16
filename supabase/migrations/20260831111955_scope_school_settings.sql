-- Fix: public.school_settings had no school_id column at all — `key` was
-- globally UNIQUE across the whole platform, meaning proctor_mode and
-- every report-card/transcript access-restriction toggle (added in an
-- earlier round) were silently shared by every school on the platform.
-- Any school's admin could see and change another school's settings.
--
-- This scopes the table properly per school. Existing rows (school_id
-- NULL, from before this fix) are left in place rather than deleted —
-- they become invisible/inert to everyone except a super-admin once RLS
-- requires same_school(school_id), which never matches NULL. Every
-- school effectively starts fresh at defaults (all these toggles default
-- to off/false) the first time it sets one after this migration — a safe
-- reset rather than a destructive delete, since there was never a
-- correct "owner" to attribute the old global values to in the first
-- place.

-- Made every DDL statement idempotent below: a first attempt at this
-- migration failed partway (ADD COLUMN school_id hit "column already
-- exists" — something in this project's history had already added it,
-- separately from this fix), which rolled back everything in the file,
-- including the RLS/constraint work that was meant to accompany it. This
-- version is safe to run regardless of which pieces already exist.

ALTER TABLE public.school_settings
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.school_settings
  DROP CONSTRAINT IF EXISTS school_settings_key_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'school_settings_school_id_key_key'
  ) THEN
    ALTER TABLE public.school_settings
      ADD CONSTRAINT school_settings_school_id_key_key UNIQUE (school_id, key);
  END IF;
END $$;

DROP POLICY IF EXISTS "Staff view settings" ON public.school_settings;
CREATE POLICY "Staff view settings" ON public.school_settings
  FOR SELECT TO authenticated USING (same_school(school_id));

DROP POLICY IF EXISTS "Admins manage settings" ON public.school_settings;
CREATE POLICY "Admins manage settings" ON public.school_settings
  FOR ALL TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(school_id));

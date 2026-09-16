-- Batch 5 (#18): audit log UI — found a real cross-tenant gap while building it
--
-- audit_log got a school_id column (and an autofill-on-insert trigger) added in an
-- earlier multi-tenant hardening pass, but its original SELECT policy from before
-- that pass — "Admins view audit log", USING (has_role(admin) OR has_role(principal))
-- — was never updated to actually filter by it. Any admin/principal, from any
-- school, querying the table directly (which the school-scoped Settings UI does)
-- currently sees every school's audit trail. The super-admin global view is
-- unaffected — it goes through the manage-school edge function on the service-role
-- key, which already gates on super_admins membership independently of this policy.
DROP POLICY IF EXISTS "Admins view audit log" ON public.audit_log;
CREATE POLICY "Admins view own school audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
    AND public.same_school(school_id)
  );

-- The insert policy was similarly permissive (WITH CHECK (true) — any authenticated
-- user could write a row claiming to be any user_id/user_name/action for any
-- school). Tightened so an entry can only be logged as the actual caller, in their
-- own school, while still requiring nothing else app code depends on.
DROP POLICY IF EXISTS "System inserts audit log" ON public.audit_log;
CREATE POLICY "Users insert own school audit log" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.same_school(school_id));

-- Fix #11 (real root cause): schools had no UPDATE policy for a regular
-- school admin/principal — only "Super admins manage schools" (super-admin
-- only, FOR ALL) and "Users view own school" (SELECT only). Every update
-- from SchoolInfoCard — including the plain name/address/phone/email fields
-- that predate the branding work, not just logo/tagline/signature/stamp —
-- has always silently affected 0 rows for a normal admin/principal.
--
-- PostgREST doesn't raise an error on a 0-row UPDATE by default, so
-- `updateError` stayed null, the client showed a success toast, and nothing
-- ever actually changed. That's why the Settings preview never updated
-- either, and why documents never picked up a logo/signature/stamp no
-- matter how many times "Image updated" appeared.
CREATE POLICY "Admins update own school"
  ON public.schools FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')) AND same_school(id));

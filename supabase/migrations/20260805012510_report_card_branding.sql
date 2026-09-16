-- Batch 6 (#10): report card redesign — branding infrastructure
--
-- Adds the school-level assets needed for the signature/stamp closing section and
-- tagline (single static Principal signature + one school stamp, uploaded once in
-- Settings, per the earlier-confirmed resolution to that open question) plus a
-- storage bucket to actually upload them — logo_url already existed as a column
-- but had no upload path either, same gap.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS principal_signature_url text,
  ADD COLUMN IF NOT EXISTS school_stamp_url text;

-- Bucket for school-level branding assets: logo, principal signature, school
-- stamp. Public read (PDF generation fetches these cross-origin via drawHeader/
-- the new signature block), writes scoped to admin/principal of the owning
-- school via a school_id-prefixed folder path — same pattern as the existing
-- avatars bucket's per-user folder scoping, just per-school instead of per-user.
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "School assets are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'school-assets');

CREATE POLICY "Admins upload their own school's assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'school-assets'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
  AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
);

CREATE POLICY "Admins update their own school's assets"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'school-assets'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
  AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
);

CREATE POLICY "Admins delete their own school's assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'school-assets'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
  AND (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
);

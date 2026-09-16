-- Investigated "deleted from DB still shows in app" / "deleted from app
-- still in DB" question. Two separate real gaps found:
--
-- 1. students.user_id already has `REFERENCES auth.users(id) ON DELETE
--    SET NULL` — so deleting a student's auth login directly (e.g. via
--    the Supabase dashboard) correctly nulls the link instead of leaving
--    a dangling reference. staff.user_id had NO foreign key to
--    auth.users at all — the same direct deletion would leave staff.user_id
--    silently pointing at a user that no longer exists. Fixed to match
--    students' existing, already-correct pattern.
--
-- 2. The app's own delete buttons (useDeleteStudent/useDeleteStaff) only
--    ran `DELETE FROM students|staff` — removing the profile row but
--    leaving the person's auth.users login and user_roles row fully
--    intact, so a "deleted" account could still log in. That part is
--    fixed at the application layer (new delete-user-account edge
--    function, routed through by both hooks) — not something a DB
--    migration alone can fix, since deleting an auth.users row requires
--    the service role via the Admin API, not a plain SQL DELETE.

ALTER TABLE public.staff
  ALTER COLUMN user_id DROP NOT NULL;

-- Defensive: null out any already-orphaned staff.user_id values first
-- (pointing at an auth user that no longer exists) so adding the FK
-- below can't fail against existing data.
UPDATE public.staff s
SET user_id = NULL
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_user_id_fkey;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

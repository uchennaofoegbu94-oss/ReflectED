-- School-scoped announcements. platform_announcements already exists
-- but is super-admin-only and platform-wide (no school_id at all) —
-- a principal has no way to post something visible only to their own
-- school. This mirrors that table's shape for consistency (same
-- announcement_type/priority conventions, so the UI can reuse the
-- same icon/color mapping) but scopes it per school and opens
-- write access to admin/principal, plus any teacher a principal has
-- specifically granted permission to.

-- Permission flag: which teachers a principal/admin has specifically
-- allowed to post announcements. Nothing else in this schema (role
-- labels, special_roles) carries an actual permission — those are
-- purely display labels — so this needs its own real flag. Added
-- first, before any policy below references it.
ALTER TABLE public.staff ADD COLUMN can_post_announcements boolean NOT NULL DEFAULT false;

CREATE TABLE public.school_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  announcement_type text NOT NULL DEFAULT 'notice' CHECK (announcement_type IN ('banner', 'notice', 'update', 'downtime')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;

-- Anyone in the school — staff, student, or parent — can read active,
-- currently-in-window announcements. This is deliberately broader than
-- most tables in this schema (which gate students/parents to only
-- their own records) because an announcement is meant to be seen by
-- the whole school, not scoped to one person.
CREATE POLICY "School members view active announcements" ON public.school_announcements
FOR SELECT TO authenticated
USING (
  same_school(school_id)
  AND is_active
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);

-- Staff who manage announcements also need to see inactive/expired
-- ones (to edit or reactivate them) — separate, broader policy for
-- exactly the people who can write.
CREATE POLICY "Announcers view all school announcements" ON public.school_announcements
FOR SELECT TO authenticated
USING (
  same_school(school_id)
  AND (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal')
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.user_id = auth.uid() AND s.school_id = school_announcements.school_id AND s.can_post_announcements
    )
  )
);

CREATE POLICY "Admins manage announcements" ON public.school_announcements
FOR ALL TO authenticated
USING (
  same_school(school_id)
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'))
)
WITH CHECK (
  same_school(school_id)
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'principal'))
);

-- Permitted teachers can create/edit/delete their own announcements
-- (not admins'/other teachers') — separate from the admin policy
-- above so an admin's blanket ALL doesn't need to also cover this
-- narrower case.
CREATE POLICY "Permitted teachers manage own announcements" ON public.school_announcements
FOR ALL TO authenticated
USING (
  same_school(school_id)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.school_id = school_announcements.school_id AND s.can_post_announcements
  )
)
WITH CHECK (
  same_school(school_id)
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.user_id = auth.uid() AND s.school_id = school_announcements.school_id AND s.can_post_announcements
  )
);

CREATE INDEX idx_school_announcements_school ON public.school_announcements(school_id);

CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.school_announcements
  FOR EACH ROW EXECUTE FUNCTION public.autofill_school_id();

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.school_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

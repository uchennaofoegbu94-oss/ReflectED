-- SECURITY FIX: Make classroom-materials bucket private
UPDATE storage.buckets SET public = false WHERE id = 'classroom-materials';

-- SECURITY FIX: Drop overly permissive profile policy and create role-based access
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

-- Staff can view all profiles (needed for school administration)
CREATE POLICY "Staff view all profiles"
ON public.profiles FOR SELECT
USING (public.is_staff(auth.uid()));

-- Students can view profiles of users in their classrooms (for collaboration)
CREATE POLICY "Students view classroom profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s
    JOIN classroom_members cm ON cm.student_id = s.id
    JOIN classroom_members cm2 ON cm2.classroom_id = cm.classroom_id
    JOIN students s2 ON s2.id = cm2.student_id
    WHERE s.user_id = auth.uid() AND s2.user_id = profiles.user_id
  )
);

-- Parents can view their children's profiles
CREATE POLICY "Parents view children profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s WHERE s.parent_id = auth.uid() AND s.user_id = profiles.user_id
  )
);

-- SECURITY FIX: Restrict special_roles visibility
DROP POLICY IF EXISTS "Special roles viewable by authenticated" ON public.special_roles;

-- Users can view active special roles (school transparency)
CREATE POLICY "Active special roles viewable"
ON public.special_roles FOR SELECT
USING (is_active = true);

-- Staff can view all special roles including inactive
CREATE POLICY "Staff view all special roles"
ON public.special_roles FOR SELECT
USING (public.is_staff(auth.uid()));
-- ROLLBACK: Make classroom-materials bucket public again
UPDATE storage.buckets SET public = true WHERE id = 'classroom-materials';

-- ROLLBACK: Remove restrictive profile policies and restore original
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Staff view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Students view classroom profiles" ON public.profiles;
DROP POLICY IF EXISTS "Parents view children profiles" ON public.profiles;

-- Restore original permissive profile policy
CREATE POLICY "Profiles viewable by authenticated" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- ROLLBACK: Remove restrictive special_roles policies and restore original
DROP POLICY IF EXISTS "Active special roles viewable" ON public.special_roles;
DROP POLICY IF EXISTS "Staff view all special roles" ON public.special_roles;

-- Restore original permissive special_roles policy
CREATE POLICY "Special roles viewable by authenticated" 
ON public.special_roles FOR SELECT 
USING (true);
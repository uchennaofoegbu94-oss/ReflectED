-- Allow users to insert their own role during signup
CREATE POLICY "Users can insert own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for classroom materials
INSERT INTO storage.buckets (id, name, public) VALUES ('classroom-materials', 'classroom-materials', true);

-- Storage policies for classroom materials
CREATE POLICY "Staff can upload materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'classroom-materials' 
  AND public.is_staff(auth.uid())
);

CREATE POLICY "Anyone can view classroom materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'classroom-materials');

CREATE POLICY "Staff can delete materials"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'classroom-materials' 
  AND public.is_staff(auth.uid())
);

CREATE POLICY "Staff can update materials"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'classroom-materials' 
  AND public.is_staff(auth.uid())
);

-- Security definer function to find a classroom by code, bypassing RLS
-- This is needed because students can't see classrooms they haven't joined yet
CREATE OR REPLACE FUNCTION public.find_classroom_by_code(_code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM public.classrooms c
  WHERE c.code = _code
  AND c.is_archived = false
  LIMIT 1;
$$;

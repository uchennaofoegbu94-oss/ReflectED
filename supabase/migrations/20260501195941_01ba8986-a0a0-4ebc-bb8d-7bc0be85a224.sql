
DROP FUNCTION IF EXISTS public.find_classroom_by_code(text);

CREATE OR REPLACE FUNCTION public.find_classroom_by_code(_code text)
RETURNS TABLE(id uuid, name text, school_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.school_id
  FROM public.classrooms c
  WHERE c.code = _code
  AND c.is_archived = false
  LIMIT 1;
$function$;

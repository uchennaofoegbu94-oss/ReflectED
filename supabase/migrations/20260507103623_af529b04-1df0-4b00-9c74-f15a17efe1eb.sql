
ALTER TABLE public.class_arms
  DROP CONSTRAINT IF EXISTS class_arms_class_teacher_id_fkey;

-- Clear any stale values that don't map to a staff row
UPDATE public.class_arms
SET class_teacher_id = NULL
WHERE class_teacher_id IS NOT NULL
  AND class_teacher_id NOT IN (SELECT id FROM public.staff);

ALTER TABLE public.class_arms
  ADD CONSTRAINT class_arms_class_teacher_id_fkey
  FOREIGN KEY (class_teacher_id) REFERENCES public.staff(id) ON DELETE SET NULL;


-- Fix class_subjects.teacher_id FK: should reference staff(id), not auth.users(id)
ALTER TABLE public.class_subjects DROP CONSTRAINT class_subjects_teacher_id_fkey;
ALTER TABLE public.class_subjects ADD CONSTRAINT class_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.staff(id) ON DELETE SET NULL;

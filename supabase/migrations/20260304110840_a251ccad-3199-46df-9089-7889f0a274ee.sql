
-- 1. Fix FK constraints on class_arms to allow deletion (SET NULL instead of NO ACTION)
ALTER TABLE public.students DROP CONSTRAINT students_class_id_fkey;
ALTER TABLE public.students ADD CONSTRAINT students_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES public.class_arms(id) ON DELETE SET NULL;

ALTER TABLE public.classrooms DROP CONSTRAINT classrooms_class_id_fkey;
ALTER TABLE public.classrooms ADD CONSTRAINT classrooms_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES public.class_arms(id) ON DELETE SET NULL;

ALTER TABLE public.fee_structures DROP CONSTRAINT fee_structures_class_id_fkey;
ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES public.class_arms(id) ON DELETE SET NULL;

-- 2. Add new special_role_type enum values
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'vice_principal';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'duty_marshall';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'music_social_coordinator';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'utilities_prefect';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'regulator';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'assistant_regulator';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'senior_prefect';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'deputy_senior_prefect';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'teacher_assistant';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'drum_major';
ALTER TYPE public.special_role_type ADD VALUE IF NOT EXISTS 'laboratories_prefect';

-- 3. Add quiz_type enum values that the UI expects
ALTER TYPE public.quiz_type ADD VALUE IF NOT EXISTS 'weekly';
ALTER TYPE public.quiz_type ADD VALUE IF NOT EXISTS 'end_term';

-- 4. Add DELETE policy for subjects (for full CRUD)
CREATE POLICY "Admins delete subjects"
ON public.subjects
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role));

-- 5. Add UPDATE policy for subjects
CREATE POLICY "Admins update subjects"
ON public.subjects
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'principal'::app_role));

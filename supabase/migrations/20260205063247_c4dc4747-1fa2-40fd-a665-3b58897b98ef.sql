-- =======================================
-- COMPREHENSIVE ASSIGNMENTS & QUIZZES MODULE
-- =======================================

-- 1. Add new enum types for content types and assignment types
DO $$ BEGIN
  -- Add assignment_content_type enum
  CREATE TYPE public.assignment_content_type AS ENUM ('typed', 'cbt', 'upload');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update assignment_type enum to include all types (will add missing values)
ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'daily';
ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'practice';

-- Update quiz_type enum to include practice
ALTER TYPE public.quiz_type ADD VALUE IF NOT EXISTS 'practice';

-- Add short_answer question type
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'short_answer';

-- 2. Enhance assignments table with new columns
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS content_type public.assignment_content_type DEFAULT 'typed',
ADD COLUMN IF NOT EXISTS allowed_file_types jsonb DEFAULT '["pdf", "doc", "docx", "jpg", "png", "link"]'::jsonb,
ADD COLUMN IF NOT EXISTS total_marks decimal DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS late_penalty_percent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rubric jsonb DEFAULT NULL;

-- 3. Enhance quizzes table with new columns
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS content_type public.assignment_content_type DEFAULT 'cbt',
ADD COLUMN IF NOT EXISTS allowed_file_types jsonb DEFAULT '["pdf", "doc", "docx", "jpg", "png"]'::jsonb,
ADD COLUMN IF NOT EXISTS total_marks decimal DEFAULT 100,
ADD COLUMN IF NOT EXISTS auto_grade boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.staff(id);

-- 4. Enhance submissions table to support both assignments and quizzes  
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS submitted_content text,
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS graded_by_staff uuid REFERENCES public.staff(id);

-- Make assignment_id nullable to support quiz submissions
ALTER TABLE public.submissions ALTER COLUMN assignment_id DROP NOT NULL;

-- Add constraint to ensure either assignment_id or quiz_id is set
DO $$ BEGIN
  ALTER TABLE public.submissions
  ADD CONSTRAINT check_assignment_or_quiz 
  CHECK (assignment_id IS NOT NULL OR quiz_id IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 5. Enhance quiz_questions table
ALTER TABLE public.quiz_questions
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS marks decimal DEFAULT 1;

-- 6. Enhance quiz_answers table  
ALTER TABLE public.quiz_answers
ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id);

-- 7. Create assessment_scores table for results integration
CREATE TABLE IF NOT EXISTS public.assessment_scores_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assessment_type text NOT NULL CHECK (assessment_type IN ('assignment', 'quiz')),
  assessment_id uuid NOT NULL,
  score decimal NOT NULL DEFAULT 0,
  total_marks decimal NOT NULL DEFAULT 100,
  percentage decimal GENERATED ALWAYS AS (
    CASE WHEN total_marks > 0 THEN ROUND((score / total_marks) * 100, 2) ELSE 0 END
  ) STORED,
  recorded_by uuid REFERENCES public.staff(id),
  recorded_at timestamptz DEFAULT now(),
  term_id uuid REFERENCES public.terms(id),
  academic_session_id uuid REFERENCES public.academic_sessions(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assessment_type, assessment_id)
);

-- Enable RLS on assessment_scores_tracker
ALTER TABLE public.assessment_scores_tracker ENABLE ROW LEVEL SECURITY;

-- RLS policies for assessment_scores_tracker
CREATE POLICY "Staff manage assessment scores"
ON public.assessment_scores_tracker FOR ALL
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Students view own scores"
ON public.assessment_scores_tracker FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = assessment_scores_tracker.student_id 
  AND s.user_id = auth.uid()
));

CREATE POLICY "Parents view children scores"
ON public.assessment_scores_tracker FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.students s
  WHERE s.id = assessment_scores_tracker.student_id 
  AND s.parent_id = auth.uid()
));

-- 8. Create notifications table for assignment/quiz notifications
CREATE TABLE IF NOT EXISTS public.assignment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('new_assignment', 'new_quiz', 'due_reminder', 'grade_published', 'submission_received', 'late_warning')),
  reference_type text NOT NULL CHECK (reference_type IN ('assignment', 'quiz', 'submission')),
  reference_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.assignment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.assignment_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System creates notifications"
ON public.assignment_notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users update own notifications"
ON public.assignment_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- 9. Create grading_rubrics table for reusable rubrics
CREATE TABLE IF NOT EXISTS public.grading_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_points decimal NOT NULL DEFAULT 100,
  created_by uuid NOT NULL REFERENCES public.staff(id),
  classroom_id uuid REFERENCES public.classrooms(id),
  is_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.grading_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage rubrics"
ON public.grading_rubrics FOR ALL
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "View rubrics"
ON public.grading_rubrics FOR SELECT
TO authenticated
USING (true);

-- 10. Create function to auto-populate assessment scores when submission is graded
CREATE OR REPLACE FUNCTION public.sync_assessment_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term_id uuid;
  v_session_id uuid;
  v_total_marks decimal;
  v_graded_by_staff uuid;
BEGIN
  -- Only proceed if status is 'graded' and grade is set
  IF NEW.status = 'graded' AND NEW.grade IS NOT NULL THEN
    -- Get active term and session
    SELECT t.id, t.session_id INTO v_term_id, v_session_id
    FROM public.terms t
    WHERE t.is_active = true
    LIMIT 1;
    
    -- Get graded_by staff id
    v_graded_by_staff := NEW.graded_by_staff;
    
    IF NEW.assignment_id IS NOT NULL THEN
      -- Get assignment total marks
      SELECT COALESCE(total_marks, points, 100) INTO v_total_marks
      FROM public.assignments WHERE id = NEW.assignment_id;
      
      -- Upsert assessment score
      INSERT INTO public.assessment_scores_tracker (
        student_id, assessment_type, assessment_id, score, total_marks, 
        recorded_by, term_id, academic_session_id
      ) VALUES (
        NEW.student_id, 'assignment', NEW.assignment_id, NEW.grade, v_total_marks,
        v_graded_by_staff, v_term_id, v_session_id
      )
      ON CONFLICT (student_id, assessment_type, assessment_id) 
      DO UPDATE SET 
        score = EXCLUDED.score,
        total_marks = EXCLUDED.total_marks,
        recorded_by = EXCLUDED.recorded_by,
        updated_at = now();
        
    ELSIF NEW.quiz_id IS NOT NULL THEN
      -- Get quiz total marks
      SELECT COALESCE(total_marks, total_points, 100) INTO v_total_marks
      FROM public.quizzes WHERE id = NEW.quiz_id;
      
      -- Upsert assessment score
      INSERT INTO public.assessment_scores_tracker (
        student_id, assessment_type, assessment_id, score, total_marks,
        recorded_by, term_id, academic_session_id
      ) VALUES (
        NEW.student_id, 'quiz', NEW.quiz_id, NEW.grade, v_total_marks,
        v_graded_by_staff, v_term_id, v_session_id
      )
      ON CONFLICT (student_id, assessment_type, assessment_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        total_marks = EXCLUDED.total_marks,
        recorded_by = EXCLUDED.recorded_by,
        updated_at = now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for syncing assessment scores
DROP TRIGGER IF EXISTS sync_assessment_score_trigger ON public.submissions;
CREATE TRIGGER sync_assessment_score_trigger
AFTER INSERT OR UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.sync_assessment_score();

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_id ON public.submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON public.assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_classroom ON public.quizzes(classroom_id);
CREATE INDEX IF NOT EXISTS idx_assessment_scores_student ON public.assessment_scores_tracker(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_scores_type ON public.assessment_scores_tracker(assessment_type, assessment_id);

-- 12. Update quiz_attempts to sync with submissions
CREATE OR REPLACE FUNCTION public.sync_quiz_attempt_to_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When quiz attempt is graded, create/update submission record
  IF NEW.submitted_at IS NOT NULL AND NEW.is_graded = true THEN
    INSERT INTO public.submissions (
      quiz_id, student_id, submitted_at, grade, status, is_late, graded_at
    ) VALUES (
      NEW.quiz_id, NEW.student_id, NEW.submitted_at, NEW.total_score, 
      'graded', false, NEW.graded_at
    )
    ON CONFLICT (student_id, quiz_id) 
    WHERE assignment_id IS NULL
    DO UPDATE SET
      grade = EXCLUDED.grade,
      status = EXCLUDED.status,
      graded_at = EXCLUDED.graded_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add unique partial index for quiz submissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_quiz_submission 
ON public.submissions(student_id, quiz_id) 
WHERE assignment_id IS NULL AND quiz_id IS NOT NULL;
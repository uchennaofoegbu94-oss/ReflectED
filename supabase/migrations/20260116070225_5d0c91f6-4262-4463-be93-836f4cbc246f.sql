-- 1. Create assignment_type enum
CREATE TYPE public.assignment_type AS ENUM (
  'holiday',
  'mid_term',
  'weekend',
  'weekly',
  'practical',
  'project'
);

-- 2. Create quiz_type enum
CREATE TYPE public.quiz_type AS ENUM (
  'resumption',
  'mid_term',
  'weekly_test',
  'end_of_term_exam'
);

-- 3. Create question_type enum
CREATE TYPE public.question_type AS ENUM (
  'multiple_choice',
  'true_false',
  'essay'
);

-- 4. Add assignment_type column to assignments table
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS assignment_type public.assignment_type DEFAULT 'weekly';

-- 5. Create quizzes table
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quiz_type public.quiz_type NOT NULL DEFAULT 'weekly_test',
  duration_minutes INTEGER DEFAULT 60,
  total_points INTEGER DEFAULT 100,
  passing_score INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT false,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  allow_review BOOLEAN DEFAULT true,
  shuffle_questions BOOLEAN DEFAULT false,
  shuffle_options BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Create quiz_questions table
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type public.question_type NOT NULL DEFAULT 'multiple_choice',
  question_text TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0,
  -- For MCQ/True-False: JSON array of options
  options JSONB,
  -- For MCQ/True-False: correct answer index or boolean
  correct_answer JSONB,
  -- For Essay: grading rubric/guidelines
  grading_rubric TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Create quiz_attempts table
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  auto_score NUMERIC DEFAULT 0,
  manual_score NUMERIC DEFAULT 0,
  total_score NUMERIC DEFAULT 0,
  is_graded BOOLEAN DEFAULT false,
  graded_by UUID,
  graded_at TIMESTAMP WITH TIME ZONE,
  feedback TEXT,
  UNIQUE(quiz_id, student_id)
);

-- 8. Create quiz_answers table
CREATE TABLE public.quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  -- For MCQ: selected option index, True/False: boolean, Essay: text
  answer JSONB,
  is_correct BOOLEAN,
  points_earned NUMERIC DEFAULT 0,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Create result_transcripts table for historical records
CREATE TABLE public.result_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  total_subjects INTEGER DEFAULT 0,
  total_score NUMERIC DEFAULT 0,
  average_score NUMERIC DEFAULT 0,
  position INTEGER,
  class_size INTEGER,
  principal_remarks TEXT,
  class_teacher_remarks TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_by UUID,
  UNIQUE(student_id, term_id)
);

-- 10. Enable RLS on all new tables
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_transcripts ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for quizzes
CREATE POLICY "Staff manage quizzes"
ON public.quizzes FOR ALL
USING (is_staff(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Students view active quizzes"
ON public.quizzes FOR SELECT
USING (
  is_active = true AND 
  EXISTS (
    SELECT 1 FROM classroom_members cm
    JOIN students s ON cm.student_id = s.id
    WHERE cm.classroom_id = quizzes.classroom_id AND s.user_id = auth.uid()
  )
);

-- 12. RLS Policies for quiz_questions
CREATE POLICY "Staff manage questions"
ON public.quiz_questions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM quizzes q WHERE q.id = quiz_questions.quiz_id AND is_staff(auth.uid())
  )
);

CREATE POLICY "Students view questions during quiz"
ON public.quiz_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM quizzes q
    JOIN classroom_members cm ON cm.classroom_id = q.classroom_id
    JOIN students s ON cm.student_id = s.id
    WHERE q.id = quiz_questions.quiz_id 
    AND q.is_active = true 
    AND s.user_id = auth.uid()
  )
);

-- 13. RLS Policies for quiz_attempts
CREATE POLICY "Students manage own attempts"
ON public.quiz_attempts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM students s WHERE s.id = quiz_attempts.student_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Staff view all attempts"
ON public.quiz_attempts FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff grade attempts"
ON public.quiz_attempts FOR UPDATE
USING (is_staff(auth.uid()));

-- 14. RLS Policies for quiz_answers
CREATE POLICY "Students manage own answers"
ON public.quiz_answers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM quiz_attempts qa
    JOIN students s ON qa.student_id = s.id
    WHERE qa.id = quiz_answers.attempt_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Staff view all answers"
ON public.quiz_answers FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff grade answers"
ON public.quiz_answers FOR UPDATE
USING (is_staff(auth.uid()));

-- 15. RLS Policies for result_transcripts
CREATE POLICY "Staff manage transcripts"
ON public.result_transcripts FOR ALL
USING (is_staff(auth.uid()));

CREATE POLICY "Students view own transcripts"
ON public.result_transcripts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s WHERE s.id = result_transcripts.student_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Parents view children transcripts"
ON public.result_transcripts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM students s WHERE s.id = result_transcripts.student_id AND s.parent_id = auth.uid()
  )
);

-- 16. Create indexes for performance
CREATE INDEX idx_quizzes_classroom ON public.quizzes(classroom_id);
CREATE INDEX idx_quizzes_created_by ON public.quizzes(created_by);
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id);
CREATE INDEX idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_student ON public.quiz_attempts(student_id);
CREATE INDEX idx_quiz_answers_attempt ON public.quiz_answers(attempt_id);
CREATE INDEX idx_result_transcripts_student ON public.result_transcripts(student_id);
CREATE INDEX idx_assignments_type ON public.assignments(assignment_type);

-- 17. Trigger for updated_at on quizzes
CREATE TRIGGER update_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
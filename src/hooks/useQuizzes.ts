import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Quiz = Database['public']['Tables']['quizzes']['Row'];
type QuizInsert = Database['public']['Tables']['quizzes']['Insert'];
type QuizQuestion = Database['public']['Tables']['quiz_questions']['Row'];
type QuizAttempt = Database['public']['Tables']['quiz_attempts']['Row'];
type QuizAnswer = Database['public']['Tables']['quiz_answers']['Row'];

export interface QuizWithDetails extends Quiz {
  classrooms?: {
    id: string;
    name: string;
  } | null;
  quiz_questions?: QuizQuestion[];
}

export interface AttemptWithDetails extends QuizAttempt {
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    avatar_url: string | null;
  } | null;
  quiz_answers?: QuizAnswer[];
}

// Fetch all quizzes for a classroom
export function useQuizzes(classroomId?: string) {
  return useQuery({
    queryKey: ['quizzes', classroomId],
    queryFn: async (): Promise<QuizWithDetails[]> => {
      let query = supabase
        .from('quizzes')
        .select(`
          *,
          classrooms (id, name),
          quiz_questions (*)
        `)
        .order('created_at', { ascending: false });

      if (classroomId) {
        query = query.eq('classroom_id', classroomId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as QuizWithDetails[];
    },
    enabled: true,
  });
}

// Fetch single quiz with questions
export function useQuiz(quizId?: string) {
  return useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async (): Promise<QuizWithDetails | null> => {
      if (!quizId) return null;
      
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          classrooms (id, name),
          quiz_questions (*)
        `)
        .eq('id', quizId)
        .single();

      if (error) throw error;
      return data as QuizWithDetails;
    },
    enabled: !!quizId,
  });
}

// Create a new quiz
export function useCreateQuiz() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (quiz: Omit<QuizInsert, 'created_by'>) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('quizzes')
        .insert({ ...quiz, created_by: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', variables.classroom_id] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz created successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to create quiz: ' + error.message);
    },
  });
}

// Update quiz
export function useUpdateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Quiz>) => {
      const { data, error } = await supabase
        .from('quizzes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['quiz', data.id] });
      toast.success('Quiz updated successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to update quiz: ' + error.message);
    },
  });
}

// Delete quiz
export function useDeleteQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz deleted successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to delete quiz: ' + error.message);
    },
  });
}

/** Archive — a reversible, browsable state distinct from deletion. Archived
 * quizzes stay out of the Active/Scheduled/Drafts tabs but remain visible
 * in the new Archived tab and in a classroom's Past Questions, and can be
 * reactivated at any time. Previously this (and its "Archived" badge) was
 * wired to is_deleted, which meant "archiving" a quiz was indistinguishable
 * from deleting it and made it vanish everywhere, including Past Questions
 * — see the migration note for the full explanation. */
export function useArchiveQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_archived: true })
        .eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['past-questions'] });
      toast.success('Quiz archived');
    },
    onError: (error: any) => toast.error('Failed to archive quiz: ' + error.message),
  });
}

export function useUnarchiveQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_archived: false })
        .eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['past-questions'] });
      toast.success('Quiz reactivated');
    },
    onError: (error: any) => toast.error('Failed to reactivate quiz: ' + error.message),
  });
}

/** True (soft) delete — for the Archived tab's "Delete" action. Distinct
 * from archiving: a deleted quiz is excluded from every query, the same
 * way it always was. Named separately from the existing useDeleteQuiz
 * above (a hard, unrecoverable delete) since the two aren't interchangeable
 * — this one participates in useRestoreQuiz below; the hard delete doesn't. */
export function useSoftDeleteQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_deleted: true })
        .eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      toast.success('Quiz deleted');
    },
    onError: (error: any) => toast.error('Failed to delete quiz: ' + error.message),
  });
}

/** Bulk archive/delete — same underlying update as the single-item hooks
 * above, applied to a whole set of quiz ids in one request (one toast,
 * one set of cache invalidations) instead of firing the single-item
 * mutation once per selected card. Backs the Quizzes page's bulk-select
 * action bar. Each row's own trg_cascade_delete_quiz_scores trigger
 * still fires per-row on the delete, so pipeline cleanup is unaffected
 * by batching the update itself. */
export function useBulkArchiveQuizzes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizIds: string[]) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_archived: true })
        .in('id', quizIds);
      if (error) throw error;
    },
    onSuccess: (_data, quizIds) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['past-questions'] });
      toast.success(`${quizIds.length} quiz${quizIds.length === 1 ? '' : 'zes'} archived`);
    },
    onError: (error: any) => toast.error('Failed to archive quizzes: ' + error.message),
  });
}

export function useBulkSoftDeleteQuizzes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizIds: string[]) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_deleted: true })
        .in('id', quizIds);
      if (error) throw error;
    },
    onSuccess: (_data, quizIds) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      toast.success(`${quizIds.length} quiz${quizIds.length === 1 ? '' : 'zes'} deleted`);
    },
    onError: (error: any) => toast.error('Failed to delete quizzes: ' + error.message),
  });
}

export function useRestoreQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_deleted: false })
        .eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      toast.success('Quiz restored');
    },
    onError: (error: any) => toast.error('Failed to restore quiz: ' + error.message),
  });
}

/** Manual visibility override, separate from is_active/scheduled_at (the
 * schedule module) — a teacher can hide an already-published quiz from
 * students without touching its schedule or activation state. */
export function useToggleQuizLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quizId, locked }: { quizId: string; locked: boolean }) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_locked: locked })
        .eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      toast.success(variables.locked ? 'Quiz locked from student view' : 'Quiz unlocked');
    },
    onError: (error: any) => toast.error('Failed to update quiz visibility: ' + error.message),
  });
}

// Add question to quiz
export function useAddQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (question: Database['public']['Tables']['quiz_questions']['Insert']) => {
      const { data, error } = await supabase
        .from('quiz_questions')
        .insert(question)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', data.quiz_id] });
      toast.success('Question added!');
    },
    onError: (error: any) => {
      toast.error('Failed to add question: ' + error.message);
    },
  });
}

// Update question
export function useUpdateQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, quizId, ...updates }: { id: string; quizId: string } & Partial<QuizQuestion>) => {
      const { data, error } = await supabase
        .from('quiz_questions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, quizId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', data.quizId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quiz', data.quizId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      toast.success('Question updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update question: ' + error.message);
    },
  });
}

// Delete question
export function useDeleteQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, quizId }: { questionId: string; quizId: string }) => {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      return quizId;
    },
    onSuccess: (quizId) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quiz', quizId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      toast.success('Question deleted!');
    },
    onError: (error: any) => {
      toast.error('Failed to delete question: ' + error.message);
    },
  });
}

// Get quiz attempts (for teachers)
export function useQuizAttempts(quizId?: string) {
  return useQuery({
    queryKey: ['quiz-attempts', quizId],
    queryFn: async (): Promise<AttemptWithDetails[]> => {
      if (!quizId) return [];
      
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          students (
            id,
            first_name,
            last_name,
            admission_number,
            avatar_url
          ),
          quiz_answers (*)
        `)
        .eq('quiz_id', quizId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AttemptWithDetails[];
    },
    enabled: !!quizId,
  });
}

// Get my quiz attempt (for students)
export function useMyQuizAttempt(quizId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-quiz-attempt', quizId],
    queryFn: async (): Promise<AttemptWithDetails | null> => {
      if (!quizId || !user) return null;
      
      // Get student ID first
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!studentData) return null;
      
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          quiz_answers (*)
        `)
        .eq('quiz_id', quizId)
        .eq('student_id', studentData.id)
        .maybeSingle();

      if (error) throw error;
      return data as AttemptWithDetails | null;
    },
    enabled: !!quizId && !!user,
  });
}

// Start quiz attempt
export function useStartQuizAttempt() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (quizId: string) => {
      if (!user) throw new Error('User not authenticated');
      
      // Get student ID
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (studentError) throw studentError;
      if (!studentData) throw new Error('Student record not found');
      
      const { data, error } = await supabase
        .from('quiz_attempts')
        .insert({
          quiz_id: quizId,
          student_id: studentData.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, quizId) => {
      queryClient.invalidateQueries({ queryKey: ['my-quiz-attempt', quizId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
    },
    onError: (error: any) => {
      toast.error('Failed to start quiz: ' + error.message);
    },
  });
}

// Submit quiz answers
export function useSubmitQuizAnswers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      attemptId, 
      answers,
      quizId
    }: { 
      attemptId: string; 
      answers: { question_id: string; answer: any }[];
      quizId: string;
    }) => {
      // Get quiz questions for auto-grading
      const { data: questions } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId);
      
      let autoScore = 0;
      const answerRecords = answers.map(ans => {
        const question = questions?.find(q => q.id === ans.question_id);
        let isCorrect = false;
        let pointsEarned = 0;
        
        if (question && (question.question_type === 'multiple_choice' || question.question_type === 'true_false')) {
          isCorrect = JSON.stringify(question.correct_answer) === JSON.stringify(ans.answer);
          if (isCorrect) {
            pointsEarned = question.points;
            autoScore += pointsEarned;
          }
        }
        
        return {
          attempt_id: attemptId,
          question_id: ans.question_id,
          answer: ans.answer,
          is_correct: question?.question_type === 'essay' ? null : isCorrect,
          points_earned: pointsEarned,
        };
      });
      
      // Insert all answers
      const { error: answersError } = await supabase
        .from('quiz_answers')
        .insert(answerRecords);
      
      if (answersError) throw answersError;
      
      // Check if there are essay questions
      const hasEssay = questions?.some(q => q.question_type === 'essay');
      
      // Update attempt with scores
      const { data, error } = await supabase
        .from('quiz_attempts')
        .update({
          submitted_at: new Date().toISOString(),
          auto_score: autoScore,
          total_score: autoScore,
          is_graded: !hasEssay, // Only fully graded if no essays
        })
        .eq('id', attemptId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-quiz-attempt', variables.quizId] });
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts', variables.quizId] });
      // The Quizzes list page (useEnhancedQuizzes) embeds quiz_attempts per
      // quiz under its own query key — without this, the Take/View button
      // stays stale until something else forces a refetch (e.g. a reload).
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      toast.success('Quiz submitted successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to submit quiz: ' + error.message);
    },
  });
}

// Grade essay answers
export function useGradeQuizAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      answerId, 
      pointsEarned, 
      feedback,
      attemptId,
      quizId
    }: { 
      answerId: string; 
      pointsEarned: number;
      feedback?: string;
      attemptId: string;
      quizId: string;
    }) => {
      // Update the answer
      const { error: answerError } = await supabase
        .from('quiz_answers')
        .update({
          points_earned: pointsEarned,
          feedback,
        })
        .eq('id', answerId);

      if (answerError) throw answerError;

      // Recalculate total score
      const { data: allAnswers } = await supabase
        .from('quiz_answers')
        .select('points_earned')
        .eq('attempt_id', attemptId);

      const totalScore = allAnswers?.reduce((sum, a) => sum + (Number(a.points_earned) || 0), 0) || 0;

      // Update attempt
      const { data, error } = await supabase
        .from('quiz_attempts')
        .update({
          total_score: totalScore,
          is_graded: true,
          graded_at: new Date().toISOString(),
        })
        .eq('id', attemptId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, quizId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts', data.quizId] });
      toast.success('Answer graded successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to grade answer: ' + error.message);
    },
  });
}

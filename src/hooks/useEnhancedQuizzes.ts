 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 
 export interface EnhancedQuiz {
   id: string;
   title: string;
   description: string | null;
   quiz_type: string;
   content_type: string | null;
   allowed_file_types: string[] | null;
   duration_minutes: number | null;
   total_points: number | null;
   total_marks: number | null;
   passing_score: number | null;
   auto_grade: boolean | null;
   classroom_id: string;
   teacher_id: string | null;
   created_by: string;
   is_active: boolean | null;
   is_deleted: boolean | null;
   is_archived: boolean | null;
   is_locked: boolean | null;
   shuffle_questions: boolean | null;
   shuffle_options: boolean | null;
   allow_review: boolean | null;
   starts_at: string | null;
   ends_at: string | null;
   scheduled_at: string | null;
   created_at: string;
   updated_at: string;
   classrooms?: {
     id: string;
     name: string;
     subjects?: { name: string; code: string } | null;
     class_arms?: { name: string; level: string } | null;
   } | null;
   quiz_questions?: Array<{
     id: string;
     question_text: string;
     question_type: string;
     options: any;
     correct_answer: any;
     points: number;
     marks: number | null;
     order_index: number;
     grading_rubric: string | null;
   }>;
   quiz_attempts?: Array<{
     id: string;
     student_id: string;
     total_score: number | null;
     is_graded: boolean | null;
     submitted_at: string | null;
   }>;
   _count?: {
     attempts: number;
     totalStudents: number;
   };
 }
 
export interface CreateQuizInput {
  title: string;
  description?: string;
  quiz_type: string;
  content_type?: string;
  allowed_file_types?: string[];
  duration_minutes?: number;
  total_points?: number;
  total_marks?: number;
  passing_score?: number;
  auto_grade?: boolean;
  classroom_id: string;
  is_active?: boolean;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  allow_review?: boolean;
  starts_at?: string;
  ends_at?: string;
  scheduled_at?: string;
  broadsheet_field_id?: string | null;
  /** Set when this quiz IS a CBT assignment's content — links it back to
   * the assignment row it belongs to. */
  assignment_id?: string | null;
}
 
 export interface QuizQuestion {
   id?: string;
   question_text: string;
   question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
   options?: string[];
   correct_answer?: any;
   points: number;
   marks?: number;
   order_index?: number;
   grading_rubric?: string;
 }
 
 // Fetch quizzes with enhanced data
 export function useEnhancedQuizzes(classroomId?: string) {
   return useQuery({
     queryKey: ['enhanced-quizzes', classroomId],
     queryFn: async (): Promise<EnhancedQuiz[]> => {
       let query = supabase
         .from('quizzes')
         .select(`
           *,
           classrooms (
             id,
             name,
             subjects (name, code),
             class_arms (name, level)
           ),
           quiz_questions (id, question_text, question_type, options, correct_answer, points, marks, order_index, grading_rubric),
           quiz_attempts (id, student_id, total_score, is_graded, submitted_at)
         `)
         .eq('is_deleted', false)
         // CBT assignments create a real quiz row under the hood
         // (quizzes.assignment_id links it back), but that quiz is the
         // assignment's content, not something that should also show up
         // as its own separate entry in the Quizzes list.
         .is('assignment_id', null)
         .order('created_at', { ascending: false });
 
       if (classroomId) {
         query = query.eq('classroom_id', classroomId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
 
       // Get member counts
       const quizzes = data || [];
       for (const quiz of quizzes) {
         if (quiz.classroom_id) {
           const { count } = await supabase
             .from('classroom_members')
             .select('*', { count: 'exact', head: true })
             .eq('classroom_id', quiz.classroom_id);
           
           (quiz as any)._count = {
             attempts: quiz.quiz_attempts?.length || 0,
             totalStudents: count || 0,
           };
         }
       }
 
       return quizzes as EnhancedQuiz[];
     },
   });
 }
 
 // Get single quiz with full details
 export function useEnhancedQuiz(id?: string) {
   return useQuery({
     queryKey: ['enhanced-quiz', id],
     queryFn: async (): Promise<EnhancedQuiz | null> => {
       if (!id) return null;
       
       const { data, error } = await supabase
         .from('quizzes')
         .select(`
           *,
           classrooms (
             id,
             name,
             subject_id,
             subjects (name, code),
             class_arms (name, level)
           ),
           quiz_questions (*),
           quiz_attempts (*)
         `)
         .eq('id', id)
         .single();
 
       if (error) throw error;
       return data as EnhancedQuiz;
     },
     enabled: !!id,
   });
 }
 
 // Create new quiz
 export function useCreateEnhancedQuiz() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (input: CreateQuizInput) => {
       if (!user) throw new Error('User not authenticated');
 
       // Get staff ID
       const { data: staffData } = await supabase
         .from('staff')
         .select('id')
         .eq('user_id', user.id)
         .maybeSingle();
 
       const { data: quiz, error } = await supabase
         .from('quizzes')
         .insert({
           title: input.title,
           description: input.description || null,
           quiz_type: input.quiz_type as any,
           content_type: (input.content_type || 'cbt') as any,
           allowed_file_types: input.allowed_file_types || ['pdf', 'doc', 'docx', 'jpg', 'png'],
           duration_minutes: input.duration_minutes || 60,
           total_points: input.total_points || 100,
           total_marks: input.total_marks || 100,
           passing_score: input.passing_score || 50,
           auto_grade: input.auto_grade ?? true,
           classroom_id: input.classroom_id,
           created_by: user.id,
           teacher_id: staffData?.id || null,
           is_active: input.is_active ?? false,
           shuffle_questions: input.shuffle_questions ?? false,
           shuffle_options: input.shuffle_options ?? false,
           allow_review: input.allow_review ?? true,
            starts_at: input.starts_at || null,
            ends_at: input.ends_at || null,
            scheduled_at: input.scheduled_at || null,
            broadsheet_field_id: input.broadsheet_field_id ?? null,
            assignment_id: input.assignment_id ?? null,
          })
         .select()
         .single();
 
       if (error) throw error;
       return quiz;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes', variables.classroom_id] });
       toast.success('Quiz created successfully!');
     },
     onError: (error: any) => {
       toast.error('Failed to create quiz: ' + error.message);
     },
   });
 }
 
 // Update quiz
 export function useUpdateEnhancedQuiz() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: { id: string } & Partial<CreateQuizInput>) => {
       const updatePayload: any = { updated_at: new Date().toISOString() };
       
       if (updates.title !== undefined) updatePayload.title = updates.title;
       if (updates.description !== undefined) updatePayload.description = updates.description;
       if (updates.quiz_type !== undefined) updatePayload.quiz_type = updates.quiz_type;
       if (updates.content_type !== undefined) updatePayload.content_type = updates.content_type;
       if (updates.allowed_file_types !== undefined) updatePayload.allowed_file_types = updates.allowed_file_types;
       if (updates.duration_minutes !== undefined) updatePayload.duration_minutes = updates.duration_minutes;
       if (updates.total_points !== undefined) updatePayload.total_points = updates.total_points;
       if (updates.total_marks !== undefined) updatePayload.total_marks = updates.total_marks;
       if (updates.passing_score !== undefined) updatePayload.passing_score = updates.passing_score;
       if (updates.auto_grade !== undefined) updatePayload.auto_grade = updates.auto_grade;
       if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;
       if (updates.shuffle_questions !== undefined) updatePayload.shuffle_questions = updates.shuffle_questions;
       if (updates.shuffle_options !== undefined) updatePayload.shuffle_options = updates.shuffle_options;
       if (updates.allow_review !== undefined) updatePayload.allow_review = updates.allow_review;
       if (updates.starts_at !== undefined) updatePayload.starts_at = updates.starts_at;
       if (updates.ends_at !== undefined) updatePayload.ends_at = updates.ends_at;
       if (updates.scheduled_at !== undefined) updatePayload.scheduled_at = updates.scheduled_at;
 
       const { data, error } = await supabase
         .from('quizzes')
         .update(updatePayload)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       queryClient.invalidateQueries({ queryKey: ['enhanced-quiz', data.id] });
       toast.success('Quiz updated successfully!');
     },
     onError: (error: any) => {
       toast.error('Failed to update quiz: ' + error.message);
     },
   });
 }
 
 // Delete quiz (soft delete)
 export function useDeleteEnhancedQuiz() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('quizzes')
         .update({ is_deleted: true })
         .eq('id', id);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       toast.success('Quiz deleted successfully!');
     },
     onError: (error: any) => {
       toast.error('Failed to delete quiz: ' + error.message);
     },
   });
 }
 
 // Activate/Publish quiz
 export function useActivateQuiz() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { data, error } = await supabase
         .from('quizzes')
         .update({ is_active: true })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       toast.success('Quiz activated!');
     },
     onError: (error: any) => {
       toast.error('Failed to activate quiz: ' + error.message);
     },
   });
 }
 
 // Deactivate quiz
 export function useDeactivateQuiz() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { data, error } = await supabase
         .from('quizzes')
         .update({ is_active: false })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       toast.success('Quiz deactivated!');
     },
     onError: (error: any) => {
       toast.error('Failed to deactivate quiz: ' + error.message);
     },
   });
 }
 
 // Add questions to quiz
 export function useAddQuizQuestions() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ quizId, questions }: { quizId: string; questions: QuizQuestion[] }) => {
       const questionsToInsert = questions.map((q, index) => ({
         quiz_id: quizId,
         question_text: q.question_text,
         question_type: q.question_type,
         options: q.options || null,
         correct_answer: q.correct_answer || null,
         points: q.points,
         marks: q.marks || q.points,
         order_index: q.order_index ?? index,
         grading_rubric: q.grading_rubric || null,
       }));
 
       const { data, error } = await supabase
         .from('quiz_questions')
         .insert(questionsToInsert)
         .select();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-quiz', variables.quizId] });
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       toast.success('Questions added!');
     },
     onError: (error: any) => {
       toast.error('Failed to add questions: ' + error.message);
     },
   });
 }
 
 // Get student's quizzes
 export function useStudentQuizzes() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ['student-quizzes', user?.id],
     queryFn: async (): Promise<EnhancedQuiz[]> => {
       if (!user) return [];
 
       // Get student's enrolled classrooms
       const { data: studentData } = await supabase
         .from('students')
         .select('id')
         .eq('user_id', user.id)
         .maybeSingle();
 
       if (!studentData) return [];
 
       const { data: memberships } = await supabase
         .from('classroom_members')
         .select('classroom_id')
         .eq('student_id', studentData.id);
 
       if (!memberships || memberships.length === 0) return [];
 
       const classroomIds = memberships.map(m => m.classroom_id);
 
       // Get active quizzes for enrolled classrooms
       const { data: quizzes, error } = await supabase
         .from('quizzes')
         .select(`
           *,
           classrooms (id, name, subjects (name, code)),
           quiz_questions (id, question_text, question_type, options, correct_answer, points, marks, order_index, grading_rubric)
         `)
         .in('classroom_id', classroomIds)
         .eq('is_active', true)
         .eq('is_deleted', false)
         .is('assignment_id', null)
         .order('created_at', { ascending: false });
 
       if (error) throw error;
 
       // Get attempts for this student
       for (const quiz of quizzes || []) {
         const { data: attempts } = await supabase
           .from('quiz_attempts')
           .select('*')
           .eq('quiz_id', quiz.id)
           .eq('student_id', studentData.id);
         
         (quiz as any).quiz_attempts = attempts || [];
       }
 
       return quizzes as EnhancedQuiz[];
     },
     enabled: !!user,
   });
 }

/** Sets/changes an EXISTING quiz's Pre-CA push target — the create-time
 * picker only covers new quizzes, this is the same thing for one that
 * already exists (used from ViewQuizDialog). */
export function useSetQuizBroadsheetField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quizId, broadsheetFieldId }: { quizId: string; broadsheetFieldId: string | null }) => {
      const { error } = await supabase
        .from('quizzes')
        .update({ broadsheet_field_id: broadsheetFieldId })
        .eq('id', quizId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-quiz', variables.quizId] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-linked-quiz'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update push target: ' + error.message);
    },
  });
}

/** Looks up the quiz a CBT-content-type assignment created (quizzes.assignment_id
 * links back to it) — the student-facing take-CBT-assignment flow uses this
 * to know which quiz to launch. */
export function useAssignmentLinkedQuiz(assignmentId?: string) {
  return useQuery({
    queryKey: ['assignment-linked-quiz', assignmentId],
    queryFn: async (): Promise<{ id: string; title: string; broadsheet_field_id: string | null } | null> => {
      if (!assignmentId) return null;
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, broadsheet_field_id')
        .eq('assignment_id', assignmentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!assignmentId,
  });
}
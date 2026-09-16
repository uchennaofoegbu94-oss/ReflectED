 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 import { describeGradingError } from '@/lib/utils';
 
 export interface EnhancedSubmission {
   id: string;
   assignment_id: string | null;
   quiz_id: string | null;
   student_id: string;
   content: string | null;
   submitted_content: string | null;
   file_url: string | null;
   submitted_at: string;
   is_late: boolean | null;
   grade: number | null;
   feedback: string | null;
   status: string | null;
   graded_at: string | null;
   graded_by: string | null;
   graded_by_staff: string | null;
   students?: {
     id: string;
     first_name: string;
     last_name: string;
     admission_number: string;
     avatar_url: string | null;
   } | null;
   attachments?: Array<{
     id: string;
     name: string;
     type: string;
     url: string;
   }>;
 }
 
 export interface GradeSubmissionInput {
   submissionId: string;
   grade: number;
   feedback?: string;
   assignmentId?: string;
   quizId?: string;
 }
 
 export interface BulkGradeInput {
   submissions: Array<{
     submissionId: string;
     grade: number;
     feedback?: string;
   }>;
   assignmentId?: string;
   quizId?: string;
 }
 
 // Get submissions for an assignment
 export function useAssignmentSubmissions(assignmentId?: string) {
   return useQuery({
     queryKey: ['assignment-submissions', assignmentId],
     queryFn: async (): Promise<EnhancedSubmission[]> => {
       if (!assignmentId) return [];
 
       const { data, error } = await supabase
         .from('submissions')
         .select(`
           *,
           students (
             id,
             first_name,
             last_name,
             admission_number,
             avatar_url
           ),
           attachments (id, name, type, url)
         `)
         .eq('assignment_id', assignmentId)
         .order('submitted_at', { ascending: false });
 
       if (error) throw error;
       return (data || []) as EnhancedSubmission[];
     },
     enabled: !!assignmentId,
   });
 }
 
 // Get submissions for a quiz
 export function useQuizSubmissions(quizId?: string) {
   return useQuery({
     queryKey: ['quiz-submissions', quizId],
     queryFn: async (): Promise<EnhancedSubmission[]> => {
       if (!quizId) return [];
 
       const { data, error } = await supabase
         .from('submissions')
         .select(`
           *,
           students (
             id,
             first_name,
             last_name,
             admission_number,
             avatar_url
           ),
           attachments (id, name, type, url)
         `)
         .eq('quiz_id', quizId)
         .order('submitted_at', { ascending: false });
 
       if (error) throw error;
       return (data || []) as EnhancedSubmission[];
     },
     enabled: !!quizId,
   });
 }
 
 // Grade a submission
 export function useGradeEnhancedSubmission() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (input: GradeSubmissionInput) => {
       if (!user) throw new Error('User not authenticated');
 
       // Get staff ID
       const { data: staffData } = await supabase
         .from('staff')
         .select('id')
         .eq('user_id', user.id)
         .maybeSingle();
 
       const { data, error } = await supabase
         .from('submissions')
         .update({
           grade: input.grade,
           feedback: input.feedback,
           status: 'graded',
           graded_at: new Date().toISOString(),
           graded_by: user.id,
           graded_by_staff: staffData?.id || null,
         })
         .eq('id', input.submissionId)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (_, variables) => {
       if (variables.assignmentId) {
         queryClient.invalidateQueries({ queryKey: ['assignment-submissions', variables.assignmentId] });
       }
       if (variables.quizId) {
         queryClient.invalidateQueries({ queryKey: ['quiz-submissions', variables.quizId] });
       }
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       toast.success('Submission graded!');
     },
     onError: (error: any) => {
       toast.error(describeGradingError(error));
     },
   });
 }
 
 // Bulk grade submissions
 export function useBulkGradeSubmissions() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (input: BulkGradeInput) => {
       if (!user) throw new Error('User not authenticated');
 
       // Get staff ID
       const { data: staffData } = await supabase
         .from('staff')
         .select('id')
         .eq('user_id', user.id)
         .maybeSingle();
 
       const results = [];
       for (const sub of input.submissions) {
         const { data, error } = await supabase
           .from('submissions')
           .update({
             grade: sub.grade,
             feedback: sub.feedback,
             status: 'graded',
             graded_at: new Date().toISOString(),
             graded_by: user.id,
             graded_by_staff: staffData?.id || null,
           })
           .eq('id', sub.submissionId)
           .select()
           .single();
 
         if (error) throw error;
         results.push(data);
       }
 
       return results;
     },
     onSuccess: (_, variables) => {
       if (variables.assignmentId) {
         queryClient.invalidateQueries({ queryKey: ['assignment-submissions', variables.assignmentId] });
       }
       if (variables.quizId) {
         queryClient.invalidateQueries({ queryKey: ['quiz-submissions', variables.quizId] });
       }
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       queryClient.invalidateQueries({ queryKey: ['enhanced-quizzes'] });
       toast.success(`${variables.submissions.length} submissions graded!`);
     },
     onError: (error: any) => {
       toast.error(describeGradingError(error));
     },
   });
 }
 
 // Get assessment analytics
 export function useAssessmentAnalytics(assessmentType: 'assignment' | 'quiz', assessmentId?: string) {
   return useQuery({
     queryKey: ['assessment-analytics', assessmentType, assessmentId],
     queryFn: async () => {
       if (!assessmentId) return null;
 
       const column = assessmentType === 'assignment' ? 'assignment_id' : 'quiz_id';
       
       const { data: submissions, error } = await supabase
         .from('submissions')
         .select('grade, status, is_late')
         .eq(column, assessmentId);
 
       if (error) throw error;
 
       const graded = submissions?.filter(s => s.status === 'graded') || [];
       const grades = graded.map(s => s.grade || 0);
 
       const analytics = {
         totalSubmissions: submissions?.length || 0,
         gradedCount: graded.length,
         pendingCount: (submissions?.length || 0) - graded.length,
         lateCount: submissions?.filter(s => s.is_late).length || 0,
         averageScore: grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0,
         highestScore: grades.length > 0 ? Math.max(...grades) : 0,
         lowestScore: grades.length > 0 ? Math.min(...grades) : 0,
         scoreDistribution: {
           excellent: grades.filter(g => g >= 90).length,
           good: grades.filter(g => g >= 70 && g < 90).length,
           average: grades.filter(g => g >= 50 && g < 70).length,
           below: grades.filter(g => g < 50).length,
         },
       };
 
       return analytics;
     },
     enabled: !!assessmentId,
   });
 }

/**
 * "Push Now" — re-triggers the Pre-CA propagation for every already-graded
 * submission/attempt of one assignment or quiz. Needed because the auto-push
 * trigger only fires on the grading write itself; if a teacher sets (or
 * changes) the target field AFTER grading already happened, those existing
 * grades would otherwise never reach Pre-CA on their own. Re-issuing the
 * same status/is_graded write re-fires the trigger — the actual scaling and
 * upsert logic all still lives server-side, this doesn't duplicate it.
 */
export function useRepushGradesToPreCA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { assignmentId?: string; quizId?: string }): Promise<{ count: number }> => {
      if (params.assignmentId) {
        const { data, error } = await supabase
          .from('submissions')
          .update({ status: 'graded', graded_at: new Date().toISOString() })
          .eq('assignment_id', params.assignmentId)
          .eq('status', 'graded')
          .not('grade', 'is', null)
          .select('id');
        if (error) throw error;
        return { count: data?.length || 0 };
      }
      if (params.quizId) {
        const { data, error } = await supabase
          .from('quiz_attempts')
          .update({ is_graded: true, graded_at: new Date().toISOString() })
          .eq('quiz_id', params.quizId)
          .eq('is_graded', true)
          .not('total_score', 'is', null)
          .select('id');
        if (error) throw error;
        return { count: data?.length || 0 };
      }
      return { count: 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet_field_scores'] });
    },
    onError: (error: any) => {
      toast.error(describeGradingError(error));
    },
  });
}
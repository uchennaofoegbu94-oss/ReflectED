import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { describeGradingError } from '@/lib/utils';

type Submission = Database['public']['Tables']['submissions']['Row'];
type SubmissionInsert = Database['public']['Tables']['submissions']['Insert'];

export interface SubmissionWithDetails extends Submission {
  students: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    avatar_url: string | null;
  } | null;
  attachments: {
    id: string;
    name: string;
    type: Database['public']['Enums']['attachment_type'];
    url: string;
  }[];
}

export function useSubmissions(assignmentId?: string) {
  return useQuery({
    queryKey: ['submissions', assignmentId],
    queryFn: async (): Promise<SubmissionWithDetails[]> => {
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
          attachments (
            id,
            name,
            type,
            url
          )
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as SubmissionWithDetails[];
    },
    enabled: !!assignmentId,
  });
}

export function useMySubmission(assignmentId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-submission', assignmentId],
    queryFn: async (): Promise<SubmissionWithDetails | null> => {
      if (!assignmentId || !user) return null;
      
      // First get the student record for this user
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (studentError) throw studentError;
      if (!studentData) return null;
      
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
          attachments (
            id,
            name,
            type,
            url
          )
        `)
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentData.id)
        .maybeSingle();

      if (error) throw error;
      return data as SubmissionWithDetails | null;
    },
    enabled: !!assignmentId && !!user,
  });
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      assignmentId, 
      content,
      attachments = []
    }: { 
      assignmentId: string; 
      content?: string;
      attachments?: { name: string; url: string; type: Database['public']['Enums']['attachment_type'] }[];
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      // Get the student record for this user
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (studentError) throw studentError;
      if (!studentData) throw new Error('Student record not found');
      
      // Get the assignment to check if it's late
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('due_date, due_time')
        .eq('id', assignmentId)
        .single();
      
      if (assignmentError) throw assignmentError;
      
      let isLate = false;
      if (assignment.due_date) {
        const dueDateTime = assignment.due_time 
          ? new Date(`${assignment.due_date}T${assignment.due_time}`)
          : new Date(`${assignment.due_date}T23:59:59`);
        isLate = new Date() > dueDateTime;
      }

      const { data: existingSubmission, error: existingSubmissionError } = await supabase
        .from('submissions')
        .select('id, status')
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentData.id)
        .maybeSingle();

      if (existingSubmissionError) throw existingSubmissionError;

      let submission: Submission;

      if (existingSubmission) {
        if (existingSubmission.status === 'graded') {
          throw new Error('This submission has already been graded and can no longer be updated');
        }

        const { data: updatedSubmission, error: updateError } = await supabase
          .from('submissions')
          .update({
            content: content || null,
            is_late: isLate,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', existingSubmission.id)
          .select()
          .single();

        if (updateError) throw updateError;
        submission = updatedSubmission;
      } else {
        const { data: createdSubmission, error: submissionError } = await supabase
          .from('submissions')
          .insert({
            assignment_id: assignmentId,
            student_id: studentData.id,
            content,
            is_late: isLate,
            status: 'submitted',
          })
          .select()
          .single();
        
        if (submissionError) throw submissionError;
        submission = createdSubmission;
      }
      
      // Add attachments if any
      if (attachments.length > 0) {
        const attachmentRecords = attachments.map(att => ({
          submission_id: submission.id,
          name: att.name,
          url: att.url,
          type: att.type,
        }));
        
        const { error: attachmentError } = await supabase
          .from('attachments')
          .insert(attachmentRecords);
        
        if (attachmentError) throw attachmentError;
      }
      
      return submission;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-submission', variables.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['submissions', variables.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions', variables.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['classroom-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-data'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment submitted successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to submit assignment: ' + error.message);
    },
  });
}

export function useGradeSubmission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      submissionId, 
      grade, 
      feedback,
      assignmentId
    }: { 
      submissionId: string; 
      grade: number;
      feedback?: string;
      assignmentId: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      // Resolve staff ID for graded_by_staff (needed for sync trigger)
      let staffId: string | null = null;
      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      staffId = staffData?.id || null;

      const { data, error } = await supabase
        .from('submissions')
        .update({
          grade,
          feedback,
          status: 'graded' as any,
          graded_at: new Date().toISOString(),
          graded_by: user.id,
          graded_by_staff: staffId,
        })
        .eq('id', submissionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submissions', variables.assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['my-submission'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-data'] });
      toast.success('Submission graded successfully!');
    },
    onError: (error: any) => {
      toast.error(describeGradingError(error));
    },
  });
}

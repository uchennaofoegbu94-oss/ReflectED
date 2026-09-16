 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 
 export interface EnhancedAssignment {
   id: string;
   title: string;
   instructions: string | null;
   assignment_type: string | null;
   content_type: string | null;
   allowed_file_types: string[] | null;
   due_date: string | null;
   due_time: string | null;
   total_marks: number | null;
   points: number | null;
   classroom_id: string;
   created_by: string;
   status: string | null;
   allow_late_submission: boolean | null;
   late_penalty_percent: number | null;
   rubric: any | null;
   topic: string | null;
   is_deleted: boolean | null;
   is_archived: boolean | null;
   is_locked: boolean | null;
   created_at: string;
   updated_at: string;
   classrooms?: {
     id: string;
     name: string;
     subject_id?: string;
     subjects?: { name: string; code: string } | null;
     class_arms?: { name: string; level: string } | null;
   } | null;
   attachments?: Array<{
     id: string;
     name: string;
     type: string;
     url: string;
   }>;
   submissions?: Array<{
     id: string;
     student_id: string;
     status: string;
     grade: number | null;
   }>;
   _count?: {
     submissions: number;
     totalStudents: number;
   };
 }
 
export interface CreateAssignmentInput {
  title: string;
  instructions?: string;
  assignment_type: string;
  content_type: string;
  allowed_file_types?: string[];
  due_date?: string;
  due_time?: string;
  total_marks?: number;
  classroom_id: string;
  status?: string;
  allow_late_submission?: boolean;
  late_penalty_percent?: number;
  topic?: string;
  attachments?: Array<{ name: string; url: string; type: string }>;
  broadsheet_field_id?: string | null;
}
 
 // Get staff ID for the current user
 async function getStaffId(userId: string): Promise<string | null> {
   const { data, error } = await supabase
     .from('staff')
     .select('id')
     .eq('user_id', userId)
     .maybeSingle();
   
   if (error || !data) return null;
   return data.id;
 }
 
 // Fetch assignments with enhanced data
 export function useEnhancedAssignments(classroomId?: string) {
   return useQuery({
     queryKey: ['enhanced-assignments', classroomId],
     queryFn: async (): Promise<EnhancedAssignment[]> => {
       let query = supabase
         .from('assignments')
         .select(`
           *,
           classrooms (
             id,
             name,
             subject_id,
             subjects (name, code),
             class_arms (name, level)
           ),
           attachments (id, name, type, url),
           submissions (id, student_id, status, grade)
         `)
         .eq('is_deleted', false)
         .order('created_at', { ascending: false });
 
       if (classroomId) {
         query = query.eq('classroom_id', classroomId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
 
       // Get member counts for each classroom
       const assignments = data || [];
       for (const assignment of assignments) {
         if (assignment.classroom_id) {
           const { count } = await supabase
             .from('classroom_members')
             .select('*', { count: 'exact', head: true })
             .eq('classroom_id', assignment.classroom_id);
           
           (assignment as any)._count = {
             submissions: assignment.submissions?.length || 0,
             totalStudents: count || 0,
           };
         }
       }
 
       return assignments as EnhancedAssignment[];
     },
   });
 }
 
 // Get single assignment with full details
 export function useEnhancedAssignment(id?: string) {
   return useQuery({
     queryKey: ['enhanced-assignment', id],
     queryFn: async (): Promise<EnhancedAssignment | null> => {
       if (!id) return null;
       
       const { data, error } = await supabase
         .from('assignments')
         .select(`
           *,
           classrooms (
             id,
             name,
             subject_id,
             subjects (name, code),
             class_arms (name, level)
           ),
           attachments (id, name, type, url),
           submissions (id, student_id, status, grade)
         `)
         .eq('id', id)
         .single();
 
       if (error) throw error;
       return data as EnhancedAssignment;
     },
     enabled: !!id,
   });
 }
 
 // Create new assignment
 export function useCreateEnhancedAssignment() {
   const queryClient = useQueryClient();
   const { user } = useAuth();
 
   return useMutation({
     mutationFn: async (input: CreateAssignmentInput) => {
       if (!user) throw new Error('User not authenticated');
 
       const { attachments, ...assignmentData } = input;
 
       const { data: assignment, error } = await supabase
         .from('assignments')
         .insert({
           title: assignmentData.title,
           instructions: assignmentData.instructions || null,
           assignment_type: assignmentData.assignment_type as any,
           content_type: (assignmentData.content_type || 'typed') as any,
           allowed_file_types: assignmentData.allowed_file_types || ['pdf', 'doc', 'docx', 'jpg', 'png', 'link'],
           due_date: assignmentData.due_date || null,
           due_time: assignmentData.due_time || null,
           total_marks: assignmentData.total_marks || 100,
           points: assignmentData.total_marks || 100,
           classroom_id: assignmentData.classroom_id,
           created_by: user.id,
           status: (assignmentData.status || 'draft') as any,
           allow_late_submission: assignmentData.allow_late_submission ?? true,
            late_penalty_percent: assignmentData.late_penalty_percent || 0,
            topic: assignmentData.topic || null,
            broadsheet_field_id: assignmentData.broadsheet_field_id ?? null,
          })
         .select()
         .single();
 
       if (error) throw error;
 
       // Add attachments if any
       if (attachments && attachments.length > 0) {
         const { error: attachError } = await supabase
           .from('attachments')
           .insert(attachments.map(att => ({
             assignment_id: assignment.id,
             name: att.name,
             url: att.url,
             type: att.type as any,
           })));
         if (attachError) throw attachError;
       }
 
       return assignment;
     },
     onSuccess: (_, variables) => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments', variables.classroom_id] });
       toast.success('Assignment created successfully!');
     },
     onError: (error: any) => {
       toast.error('Failed to create assignment: ' + error.message);
     },
   });
 }
 
 // Update assignment
 export function useUpdateEnhancedAssignment() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ id, ...updates }: { id: string } & Partial<CreateAssignmentInput>) => {
       const { attachments, ...assignmentData } = updates;
 
       const updatePayload: any = { updated_at: new Date().toISOString() };
       if (assignmentData.title !== undefined) updatePayload.title = assignmentData.title;
       if (assignmentData.instructions !== undefined) updatePayload.instructions = assignmentData.instructions;
       if (assignmentData.assignment_type !== undefined) updatePayload.assignment_type = assignmentData.assignment_type;
       if (assignmentData.content_type !== undefined) updatePayload.content_type = assignmentData.content_type;
       if (assignmentData.allowed_file_types !== undefined) updatePayload.allowed_file_types = assignmentData.allowed_file_types;
       if (assignmentData.due_date !== undefined) updatePayload.due_date = assignmentData.due_date;
       if (assignmentData.due_time !== undefined) updatePayload.due_time = assignmentData.due_time;
       if (assignmentData.total_marks !== undefined) {
         updatePayload.total_marks = assignmentData.total_marks;
         updatePayload.points = assignmentData.total_marks;
       }
       if (assignmentData.status !== undefined) updatePayload.status = assignmentData.status;
       if (assignmentData.allow_late_submission !== undefined) updatePayload.allow_late_submission = assignmentData.allow_late_submission;
       if (assignmentData.late_penalty_percent !== undefined) updatePayload.late_penalty_percent = assignmentData.late_penalty_percent;
       if (assignmentData.topic !== undefined) updatePayload.topic = assignmentData.topic;
 
       const { data, error } = await supabase
         .from('assignments')
         .update(updatePayload)
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: (data) => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignment', data.id] });
       toast.success('Assignment updated successfully!');
     },
     onError: (error: any) => {
       toast.error('Failed to update assignment: ' + error.message);
     },
   });
 }
 
 // Delete assignment (soft delete)
 export function useDeleteEnhancedAssignment() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('assignments')
         .update({ is_deleted: true })
         .eq('id', id);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       toast.success('Assignment deleted successfully!');
     },
     onError: (error: any) => {
       toast.error('Failed to delete assignment: ' + error.message);
     },
   });
 }

 /** Archive — a reversible, browsable state distinct from deletion, mirroring
  * useArchiveQuiz/useUnarchiveQuiz. Archived assignments stay out of the
  * Active/Drafts tabs but remain visible in a new Archived tab and in a
  * classroom's Past Questions, and can be reactivated at any time. */
 export function useArchiveEnhancedAssignment() {
   const queryClient = useQueryClient();

   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('assignments')
         .update({ is_archived: true })
         .eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       queryClient.invalidateQueries({ queryKey: ['past-assignments'] });
       toast.success('Assignment archived');
     },
     onError: (error: any) => toast.error('Failed to archive assignment: ' + error.message),
   });
 }

 export function useUnarchiveEnhancedAssignment() {
   const queryClient = useQueryClient();

   return useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('assignments')
         .update({ is_archived: false })
         .eq('id', id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       queryClient.invalidateQueries({ queryKey: ['past-assignments'] });
       toast.success('Assignment reactivated');
     },
     onError: (error: any) => toast.error('Failed to reactivate assignment: ' + error.message),
   });
 }

/** Bulk archive/delete — mirrors useBulkArchiveQuizzes/useBulkSoftDeleteQuizzes,
 * one request for a whole selected set instead of one mutation per card.
 * Backs the Assignments page's bulk-select action bar. Per-row
 * trg_cascade_delete_assignment_scores still fires for each deleted row. */
export function useBulkArchiveEnhancedAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('assignments')
        .update({ is_archived: true })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['past-assignments'] });
      toast.success(`${ids.length} assignment${ids.length === 1 ? '' : 's'} archived`);
    },
    onError: (error: any) => toast.error('Failed to archive assignments: ' + error.message),
  });
}

export function useBulkDeleteEnhancedAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('assignments')
        .update({ is_deleted: true })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
      toast.success(`${ids.length} assignment${ids.length === 1 ? '' : 's'} deleted`);
    },
    onError: (error: any) => toast.error('Failed to delete assignments: ' + error.message),
  });
}

/** Mirrors useToggleQuizLock — same shallow visibility-marker semantic
 * (not RLS-enforced, just a status shown as a badge), added so Assignment
 * Grading has the same Lock/Unlock control View Quiz already had. */
export function useToggleAssignmentLock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, locked }: { assignmentId: string; locked: boolean }) => {
      const { error } = await supabase
        .from('assignments')
        .update({ is_locked: locked })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['enhanced-assignment', variables.assignmentId] });
      toast.success(variables.locked ? 'Assignment locked from student view' : 'Assignment unlocked');
    },
    onError: (error: any) => toast.error('Failed to update assignment visibility: ' + error.message),
  });
}
 
 // Publish assignment
 export function usePublishAssignment() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { data, error } = await supabase
         .from('assignments')
         .update({ status: 'published' })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       toast.success('Assignment published!');
     },
     onError: (error: any) => {
       toast.error('Failed to publish assignment: ' + error.message);
     },
   });
 }
 
 // Close assignment
 export function useCloseAssignment() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (id: string) => {
       const { data, error } = await supabase
         .from('assignments')
         .update({ status: 'closed' as any })
         .eq('id', id)
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
       toast.success('Assignment closed!');
     },
     onError: (error: any) => {
       toast.error('Failed to close assignment: ' + error.message);
     },
   });
 }
 
 // Get student's assignments
 export function useStudentAssignments() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ['student-assignments', user?.id],
     queryFn: async (): Promise<EnhancedAssignment[]> => {
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
 
       // Get assignments for enrolled classrooms
       const { data: assignments, error } = await supabase
         .from('assignments')
         .select(`
           *,
           classrooms (
             id,
             name,
             subject_id,
             subjects (name, code)
           ),
           attachments (id, name, type, url),
           submissions!inner (id, student_id, status, grade, is_late, submitted_at)
         `)
         .in('classroom_id', classroomIds)
         .eq('status', 'published')
         .eq('is_deleted', false)
         .order('due_date', { ascending: true });
 
       if (error) {
         // Try without inner join for assignments without submissions
         const { data: allAssignments, error: err2 } = await supabase
           .from('assignments')
           .select(`
             *,
             classrooms (id, name, subject_id, subjects (name, code)),
             attachments (id, name, type, url)
           `)
           .in('classroom_id', classroomIds)
           .eq('status', 'published')
           .eq('is_deleted', false)
           .order('due_date', { ascending: true });
 
         if (err2) throw err2;
 
         // Get submissions for this student
         for (const assignment of allAssignments || []) {
           const { data: subs } = await supabase
             .from('submissions')
             .select('id, student_id, status, grade, is_late, submitted_at')
             .eq('assignment_id', assignment.id)
             .eq('student_id', studentData.id);
           
           (assignment as any).submissions = subs || [];
         }
 
         return allAssignments as EnhancedAssignment[];
       }
 
       return assignments as EnhancedAssignment[];
     },
     enabled: !!user,
   });
 }
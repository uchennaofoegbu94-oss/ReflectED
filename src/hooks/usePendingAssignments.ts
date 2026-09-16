import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PendingAssignment {
  id: string;
  title: string;
  subject: string;
  due: string;
  submissions: number;
  total: number;
}

export function usePendingAssignments() {
  return useQuery({
    queryKey: ['pending-assignments'],
    queryFn: async (): Promise<PendingAssignment[]> => {
      // Fetch assignments that are published or scheduled
      const { data: assignments, error } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          due_date,
          status,
          classrooms(
            name,
            subjects(name)
          )
        `)
        .in('status', ['published', 'draft'])
        .order('due_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      // For each assignment, get submission count and total students in classroom
      const pendingAssignments: PendingAssignment[] = await Promise.all(
        (assignments || []).map(async (assignment) => {
          const classroom = assignment.classrooms as any;
          
          // Get submission count for this assignment
          const { count: submissionCount } = await supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('assignment_id', assignment.id);

          // Get total students in the classroom
          const { count: totalStudents } = await supabase
            .from('classroom_members')
            .select('id', { count: 'exact', head: true })
            .eq('classroom_id', (assignment.classrooms as any)?.id || '');

          return {
            id: assignment.id,
            title: assignment.title,
            subject: classroom?.subjects?.name || classroom?.name || 'Unknown Subject',
            due: assignment.due_date 
              ? new Date(assignment.due_date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
              : 'No due date',
            submissions: submissionCount || 0,
            total: totalStudents || 0,
          };
        })
      );

      return pendingAssignments;
    },
  });
}

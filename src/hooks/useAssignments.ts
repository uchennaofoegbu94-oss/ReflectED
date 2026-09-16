import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Assignment = Database['public']['Tables']['assignments']['Row'];
type AssignmentInsert = Database['public']['Tables']['assignments']['Insert'];
type AssignmentUpdate = Database['public']['Tables']['assignments']['Update'];

export interface AssignmentWithDetails extends Assignment {
  classrooms: {
    id: string;
    name: string;
  } | null;
  attachments: {
    id: string;
    name: string;
    type: Database['public']['Enums']['attachment_type'];
    url: string;
  }[];
}

export function useAssignments(classroomId?: string) {
  return useQuery({
    queryKey: ['assignments', classroomId],
    queryFn: async (): Promise<AssignmentWithDetails[]> => {
      let query = supabase
        .from('assignments')
        .select(`
          *,
          classrooms (
            id,
            name
          ),
          attachments (
            id,
            name,
            type,
            url
          )
        `)
        .order('created_at', { ascending: false });

      if (classroomId) {
        query = query.eq('classroom_id', classroomId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AssignmentWithDetails[];
    },
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: ['assignments', 'detail', id],
    queryFn: async (): Promise<AssignmentWithDetails | null> => {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          classrooms (
            id,
            name
          ),
          attachments (
            id,
            name,
            type,
            url
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as AssignmentWithDetails | null;
    },
    enabled: !!id,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (assignment: AssignmentInsert) => {
      const { data, error } = await supabase
        .from('assignments')
        .insert(assignment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...update }: AssignmentUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('assignments')
        .update(update)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useSchoolId } from './useSchoolId';

type Classroom = Database['public']['Tables']['classrooms']['Row'];
type ClassroomInsert = Database['public']['Tables']['classrooms']['Insert'];

export interface ClassroomWithDetails extends Classroom {
  subjects: {
    id: string;
    name: string;
    code: string;
  } | null;
  class_arms: {
    id: string;
    name: string;
    arm: string;
  } | null;
}

export function useClassrooms() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['classrooms', schoolId],
    queryFn: async (): Promise<ClassroomWithDetails[]> => {
      const { data, error } = await supabase
        .from('classrooms')
        .select(`
          *,
          subjects (
            id,
            name,
            code
          ),
          class_arms (
            id,
            name,
            arm
          )
        `)
        .eq('is_archived', false)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as ClassroomWithDetails[];
    },
    enabled: !!schoolId,
  });
}

export function useClassroom(id: string) {
  return useQuery({
    queryKey: ['classrooms', id],
    queryFn: async (): Promise<ClassroomWithDetails | null> => {
      const { data, error } = await supabase
        .from('classrooms')
        .select(`
          *,
          subjects (
            id,
            name,
            code
          ),
          class_arms (
            id,
            name,
            arm
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as ClassroomWithDetails | null;
    },
    enabled: !!id,
  });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (classroom: ClassroomInsert) => {
      const { data, error } = await supabase
        .from('classrooms')
        .insert(classroom)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}

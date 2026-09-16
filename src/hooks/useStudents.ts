import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useSchoolId, withSchoolId } from './useSchoolId';

type Student = Database['public']['Tables']['students']['Row'];
type StudentInsert = Database['public']['Tables']['students']['Insert'];
type StudentUpdate = Database['public']['Tables']['students']['Update'];

export interface StudentWithClass extends Student {
  class_arms: {
    id: string;
    name: string;
    arm: string;
    level: Database['public']['Enums']['class_level'];
  } | null;
}

export function useStudents() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['students', schoolId],
    queryFn: async (): Promise<StudentWithClass[]> => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          class_arms (
            id,
            name,
            arm,
            level
          )
        `)
        .eq('school_id', schoolId)
        .order('last_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}

export function useStudent(id: string) {
  return useQuery({
    queryKey: ['students', id],
    queryFn: async (): Promise<StudentWithClass | null> => {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          class_arms (
            id,
            name,
            arm,
            level
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (student: StudentInsert) => {
      const payload = student.school_id ? student : withSchoolId(student, schoolId);
      const { data, error } = await supabase
        .from('students')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...update }: StudentUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('students')
        .update(update)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Routed through delete-user-account (service role) instead of a
      // plain table delete — a bare DELETE FROM students only removed the
      // profile row and left the student's auth.users login + user_roles
      // row fully intact, so a "deleted" student could still sign in.
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: { domain_table: 'students', domain_id: id },
        headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.warning) console.warn(data.warning);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

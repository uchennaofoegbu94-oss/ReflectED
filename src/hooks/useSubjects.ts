import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useSchoolId, withSchoolId } from './useSchoolId';

type Subject = Database['public']['Tables']['subjects']['Row'];
type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];

export function useSubjects() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: async (): Promise<Subject[]> => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (subject: SubjectInsert) => {
      const payload = subject.school_id ? subject : withSchoolId(subject, schoolId);
      const { data, error } = await supabase
        .from('subjects')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; code?: string; description?: string | null }) => {
      const { data, error } = await supabase
        .from('subjects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

type ClassSubject = Database['public']['Tables']['class_subjects']['Row'];
type ClassSubjectInsert = Database['public']['Tables']['class_subjects']['Insert'];

export function useClassSubjects() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['class_subjects', schoolId],
    queryFn: async (): Promise<ClassSubject[]> => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('class_subjects')
        .select('*')
        .eq('school_id', schoolId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}

export function useAssignSubjectToClass() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (classSubject: ClassSubjectInsert) => {
      const payload = classSubject.school_id ? classSubject : withSchoolId(classSubject, schoolId);
      const { data, error } = await supabase
        .from('class_subjects')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_subjects'] });
    },
  });
}

export function useRemoveClassSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('class_subjects')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_subjects'] });
    },
  });
}

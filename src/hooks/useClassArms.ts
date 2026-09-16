import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useSchoolId, withSchoolId } from './useSchoolId';

type ClassArm = Database['public']['Tables']['class_arms']['Row'];
type ClassArmInsert = Database['public']['Tables']['class_arms']['Insert'];

export function useClassArms() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['class_arms', schoolId],
    queryFn: async (): Promise<ClassArm[]> => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('class_arms')
        .select('*')
        .eq('school_id', schoolId)
        .order('level', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}

export function useCreateClassArm() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (classArm: ClassArmInsert) => {
      const payload = classArm.school_id ? classArm : withSchoolId(classArm, schoolId);
      const { data, error } = await supabase
        .from('class_arms')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_arms'] });
    },
  });
}

export function useUpdateClassArm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClassArm> & { id: string }) => {
      const { data, error } = await supabase
        .from('class_arms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_arms'] });
    },
  });
}

export function useDeleteClassArm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error: studentError } = await supabase
        .from('students')
        .update({ class_id: null })
        .eq('class_id', id);
      if (studentError) throw studentError;

      const { error: classroomError } = await supabase
        .from('classrooms')
        .update({ class_id: null })
        .eq('class_id', id);
      if (classroomError) throw classroomError;

      const { error } = await supabase
        .from('class_arms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class_arms'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}

export function getClassDisplayName(classArm: ClassArm | null): string {
  if (!classArm) return '';
  return `${classArm.name} ${classArm.arm}`;
}

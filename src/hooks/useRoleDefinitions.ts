import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSchoolId } from './useSchoolId';

export interface RoleDefinition {
  id: string;
  key: string;
  label: string;
  category: 'staff' | 'student';
  is_system: boolean;
  created_at: string;
  created_by: string | null;
}

export function useRoleDefinitions(category?: 'staff' | 'student') {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['role-definitions', schoolId, category],
    queryFn: async (): Promise<RoleDefinition[]> => {
      let query = supabase
        .from('role_definitions')
        .select('*')
        .order('label');

      // System roles have NULL school_id and apply to all tenants;
      // also include custom roles for this school.
      if (schoolId) {
        query = query.or(`school_id.eq.${schoolId},school_id.is.null`);
      } else {
        query = query.is('school_id', null);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RoleDefinition[];
    },
  });
}

export function useCreateRoleDefinition() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (input: { key: string; label: string; category: 'staff' | 'student'; created_by: string }) => {
      if (!schoolId) throw new Error('No school context.');
      const { data, error } = await supabase
        .from('role_definitions')
        .insert({
          key: input.key,
          label: input.label,
          category: input.category,
          is_system: false,
          created_by: input.created_by,
          school_id: schoolId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-definitions'] });
      toast.success('Role created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create role');
    },
  });
}

export function useUpdateRoleDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { data, error } = await supabase
        .from('role_definitions')
        .update({ label })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-definitions'] });
      toast.success('Role updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete role');
    },
  });
}

export function useDeleteRoleDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('role_definitions')
        .delete()
        .eq('id', id)
        .eq('is_system', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-definitions'] });
      toast.success('Role deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete role');
    },
  });
}

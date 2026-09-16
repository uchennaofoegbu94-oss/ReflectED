import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ClassroomMaterialRecord {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  link_url: string | null;
  topic: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export function useClassroomMaterials(classroomId?: string) {
  return useQuery({
    queryKey: ['classroom-materials', classroomId],
    queryFn: async (): Promise<ClassroomMaterialRecord[]> => {
      if (!classroomId) return [];

      const { data, error } = await supabase
        .from('classroom_materials')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ClassroomMaterialRecord[];
    },
    enabled: !!classroomId,
  });
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      classroom_id: string;
      title: string;
      description?: string;
      file_url?: string;
      file_name?: string;
      file_type?: string;
      file_size?: number;
      link_url?: string;
      topic?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('classroom_materials')
        .insert({
          classroom_id: input.classroom_id,
          title: input.title,
          description: input.description || null,
          file_url: input.file_url || null,
          file_name: input.file_name || null,
          file_type: input.file_type || null,
          file_size: input.file_size || null,
          link_url: input.link_url || null,
          topic: input.topic || null,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['classroom-materials', variables.classroom_id] });
      toast.success('Material added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add material');
    },
  });
}

export function useDeleteMaterial() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classroomId }: { id: string; classroomId: string }) => {
      const { error } = await supabase
        .from('classroom_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return classroomId;
    },
    onSuccess: (classroomId) => {
      queryClient.invalidateQueries({ queryKey: ['classroom-materials', classroomId] });
      toast.success('Material deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete material');
    },
  });
}

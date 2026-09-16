import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GradingScale {
  id: string;
  grade: string;
  min_score: number;
  max_score: number;
  remark: string;
  created_at?: string;
  updated_at?: string;
}

export function useGradingScales() {
  return useQuery({
    queryKey: ['grading-scales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grading_scales')
        .select('*')
        .order('max_score', { ascending: false });
      if (error) throw error;
      return data as GradingScale[];
    },
  });
}

export function useUpdateGradingScale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scale: GradingScale) => {
      const { error } = await supabase
        .from('grading_scales')
        .update({
          grade: scale.grade,
          min_score: scale.min_score,
          max_score: scale.max_score,
          remark: scale.remark,
        })
        .eq('id', scale.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-scales'] });
      toast.success('Grading scale updated');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useAddGradingScale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scale: Omit<GradingScale, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('grading_scales')
        .insert([scale]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-scales'] });
      toast.success('Grading scale added');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useDeleteGradingScale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('grading_scales')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-scales'] });
      toast.success('Grading scale deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export function useFeeStructures() {
  return useQuery({
    queryKey: ['fee-structures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_structures')
        .select(`
          *,
          class_arms:class_id(id, name, arm),
          terms:term_id(id, name)
        `)
        .order('description', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function usePayments() {
  return useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          students:student_id(id, first_name, last_name, admission_number, class_id, class_arms:class_id(name, arm)),
          fee_structures:fee_id(id, description, amount)
        `)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useStudentsForFees() {
  return useQuery({
    queryKey: ['students-for-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, class_id, class_arms:class_id(name, arm)')
        .eq('enrollment_status', 'active')
        .order('first_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fee: {
      description: string;
      amount: number;
      class_id: string | null;
      term_id: string | null;
      is_mandatory: boolean;
    }) => {
      const { data, error } = await supabase.from('fee_structures').insert(fee).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      toast.success('Fee structure created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      description?: string;
      amount?: number;
      class_id?: string | null;
      term_id?: string | null;
      is_mandatory?: boolean;
    }) => {
      const { data, error } = await supabase.from('fee_structures').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      toast.success('Fee structure updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_structures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      toast.success('Fee structure deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payment: {
      student_id: string;
      fee_id: string;
      amount: number;
      method: 'cash' | 'bank_transfer' | 'pos';
      receipt_number?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          ...payment,
          recorded_by: user?.id || null,
          status: 'confirmed' as const,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Payment recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

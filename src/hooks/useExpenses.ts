import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface SchoolExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  payment_date: string;
  paid_to: string | null;
  receipt_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  approved_by: string | null;
  status: string;
  created_at: string;
}

const EXPENSE_CATEGORIES = [
  'Salaries & Wages',
  'Utilities',
  'Maintenance & Repairs',
  'Supplies & Materials',
  'Transportation',
  'Events & Activities',
  'Equipment',
  'Professional Services',
  'Insurance',
  'Miscellaneous',
] as const;

export { EXPENSE_CATEGORIES };

export function useExpenses() {
  return useQuery({
    queryKey: ['school-expenses'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('school_expenses' as any)
        .select('*')
        .order('payment_date', { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as SchoolExpense[];
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (expense: {
      description: string;
      amount: number;
      category: string;
      payment_date: string;
      paid_to?: string;
      receipt_number?: string;
      notes?: string;
      status?: string;
    }) => {
      const { data, error } = await (supabase
        .from('school_expenses' as any)
        .insert({
          ...expense,
          recorded_by: user?.id || null,
          status: expense.status || 'approved',
        })
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-expenses'] });
      toast.success('Expense recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { data, error } = await (supabase
        .from('school_expenses' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-expenses'] });
      toast.success('Expense updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('school_expenses' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-expenses'] });
      toast.success('Expense deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

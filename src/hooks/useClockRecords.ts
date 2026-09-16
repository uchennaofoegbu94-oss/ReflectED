import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useStaffClockRecords(staffId?: string) {
  return useQuery({
    queryKey: ['clock-records', staffId],
    queryFn: async () => {
      if (!staffId) return [];
      const { data, error } = await supabase
        .from('staff_clock_records' as any)
        .select('*')
        .eq('staff_id', staffId)
        .order('date', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!staffId,
  });
}

export function useTodayClockRecord(staffId?: string) {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['clock-record-today', staffId, today],
    queryFn: async () => {
      if (!staffId) return null;
      const { data, error } = await supabase
        .from('staff_clock_records' as any)
        .select('*')
        .eq('staff_id', staffId)
        .eq('date', today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!staffId,
  });
}

export function useClockIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, method = 'qr' }: { staffId: string; method?: string }) => {
      const today = new Date().toISOString().split('T')[0];
      // Check if already clocked in
      const { data: existing } = await supabase
        .from('staff_clock_records' as any)
        .select('id')
        .eq('staff_id', staffId)
        .eq('date', today)
        .maybeSingle();
      
      if (existing) throw new Error('Already clocked in today');

      const { error } = await supabase
        .from('staff_clock_records' as any)
        .insert({ staff_id: staffId, date: today, method, clock_in: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-record-today'] });
      queryClient.invalidateQueries({ queryKey: ['clock-records'] });
      toast.success('Clocked in successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staffId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('staff_clock_records' as any)
        .select('id, clock_out')
        .eq('staff_id', staffId)
        .eq('date', today)
        .maybeSingle();

      if (!existing) throw new Error('Not clocked in today');
      if ((existing as any).clock_out) throw new Error('Already clocked out today');

      const { error } = await supabase
        .from('staff_clock_records' as any)
        .update({ clock_out: new Date().toISOString() })
        .eq('id', (existing as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clock-record-today'] });
      queryClient.invalidateQueries({ queryKey: ['clock-records'] });
      toast.success('Clocked out successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

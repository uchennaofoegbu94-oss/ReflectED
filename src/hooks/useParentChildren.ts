import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ParentChild {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  admission_number: string;
  gender: string;
  avatar_url: string | null;
  class_id: string | null;
  class_arms?: { name: string; arm: string } | null;
}

export function useParentChildren() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent-children', user?.id],
    queryFn: async (): Promise<ParentChild[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, middle_name, admission_number, gender, avatar_url, class_id, class_arms (name, arm)')
        .eq('parent_id', user.id);

      if (error) throw error;
      return (data || []) as unknown as ParentChild[];
    },
    enabled: !!user && user.role === 'parent',
  });
}

export function useLinkChild() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (admissionNumber: string) => {
      const { data, error } = await supabase.rpc('link_child_to_parent', {
        p_admission_number: admissionNumber,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-children', user?.id] });
      toast.success('Child linked successfully!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to link child. Check the admission number.');
    },
  });
}

export function useUnlinkChild() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase.rpc('unlink_child_from_parent', {
        p_student_id: studentId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-children', user?.id] });
      toast.success('Child unlinked successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unlink child');
    },
  });
}

export interface ChildDashboardStats {
  attendanceRate: number | null; // percentage, 0-100
  termAverage: number | null;
  outstandingFees: number | null;
}

/** The three parent-dashboard stat cards (Attendance / Term Average /
 * Outstanding Fees) — previously hardcoded to "--" with no query behind
 * them at all. Deliberately scoped to a single studentId (rather than
 * reusing the admin-facing whole-school hooks) so a parent's request only
 * ever asks for their own child's rows, and reuses the same canonical
 * sources already established elsewhere: result_transcripts.average_score
 * for the term average (same as Broadsheet/Report Card/Class Average),
 * and the student_fees/payments effective-balance logic from
 * useStudentFeeBalances, inlined here scoped to one student instead of
 * every student in the school. */
export function useChildDashboardStats(studentId?: string) {
  return useQuery({
    queryKey: ['child-dashboard-stats', studentId],
    queryFn: async (): Promise<ChildDashboardStats> => {
      if (!studentId) return { attendanceRate: null, termAverage: null, outstandingFees: null };

      const { data: activeTerm } = await supabase
        .from('terms')
        .select('id, start_date, end_date')
        .eq('is_active', true)
        .maybeSingle();

      const [attendanceRes, transcriptRes, feesRes, paymentsRes] = await Promise.all([
        activeTerm
          ? supabase
              .from('attendance_records')
              .select('status')
              .eq('student_id', studentId)
              .gte('date', activeTerm.start_date)
              .lte('date', activeTerm.end_date)
          : Promise.resolve({ data: [], error: null } as any),

        activeTerm
          ? supabase
              .from('result_transcripts')
              .select('average_score')
              .eq('student_id', studentId)
              .eq('term_id', activeTerm.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),

        supabase
          .from('student_fees')
          .select('custom_amount, waived, fee_structures (amount)')
          .eq('student_id', studentId),

        supabase
          .from('payments')
          .select('amount')
          .eq('student_id', studentId)
          .eq('status', 'confirmed'),
      ]);

      if (attendanceRes.error) throw attendanceRes.error;
      if (transcriptRes.error) throw transcriptRes.error;
      if (feesRes.error) throw feesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const attendanceRows = (attendanceRes.data || []) as { status: string }[];
      const presentLike = attendanceRows.filter(r => r.status === 'present' || r.status === 'late').length;
      const attendanceRate = attendanceRows.length > 0
        ? Math.round((presentLike / attendanceRows.length) * 1000) / 10
        : null;

      const termAverage = transcriptRes.data?.average_score != null
        ? Number(transcriptRes.data.average_score)
        : null;

      const feeLines = (feesRes.data || []) as { custom_amount: number | null; waived: boolean; fee_structures: { amount: number } | null }[];
      const totalOwed = feeLines.reduce((sum, line) => {
        if (line.waived) return sum;
        return sum + (line.custom_amount ?? line.fee_structures?.amount ?? 0);
      }, 0);
      const totalPaid = (paymentsRes.data || []).reduce((sum, p: any) => sum + Number(p.amount), 0);
      const outstandingFees = feeLines.length > 0 ? Math.max(totalOwed - totalPaid, 0) : null;

      return { attendanceRate, termAverage, outstandingFees };
    },
    enabled: !!studentId,
  });
}

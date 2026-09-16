import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolId } from './useSchoolId';

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  attendanceRate: number;
  feesCollected: number;
  newStudentsThisMonth: number;
  newTeachersThisTerm: number;
}

export function useDashboardStats() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['dashboard-stats', schoolId],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const today = now.toISOString().split('T')[0];

      // Fetch all data in parallel
      const [
        studentsResult,
        newStudentsResult,
        teachersResult,
        attendanceTodayResult,
        paymentsResult,
      ] = await Promise.all([
        // Total active students
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('enrollment_status', 'active'),
        
        // New students this month
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        
        // Total active teachers (staff with active status)
        supabase
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('employment_status', 'active'),
        
        // Today's attendance records
        supabase
          .from('attendance_records')
          .select('status')
          .eq('date', today),
        
        // Total confirmed payments
        supabase
          .from('payments')
          .select('amount')
          .eq('status', 'confirmed'),
      ]);

      const totalStudents = studentsResult.count || 0;
      const newStudentsThisMonth = newStudentsResult.count || 0;
      const totalTeachers = teachersResult.count || 0;

      // Calculate attendance rate
      const attendanceRecords = attendanceTodayResult.data || [];
      const presentCount = attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const attendanceRate = attendanceRecords.length > 0 
        ? Math.round((presentCount / attendanceRecords.length) * 100 * 10) / 10
        : 0;

      // Calculate total fees collected
      const payments = paymentsResult.data || [];
      const feesCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        totalStudents,
        totalTeachers,
        attendanceRate,
        feesCollected,
        newStudentsThisMonth,
        newTeachersThisTerm: 0, // Would need a term reference to calculate
      };
    },
    enabled: !!schoolId,
  });
}

export interface RecentPayment {
  id: string;
  amount: number;
  method: string | null;
  created_at: string;
  student_name: string;
}

/** Powers the accountant dashboard's "Recent Payments" panel — a
 * finance-relevant replacement for the generic "Recent Activity" feed
 * AdminDashboard shows (which is about assignments/classroom posts, not
 * money — not useful for this role). */
export function useRecentPayments(limit = 6) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['recent-payments', schoolId, limit],
    queryFn: async (): Promise<RecentPayment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, method, created_at, status, students (first_name, last_name)')
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        created_at: p.created_at,
        student_name: p.students ? `${p.students.first_name} ${p.students.last_name}` : 'Unknown student',
      }));
    },
    enabled: !!schoolId,
  });
}

/** Total outstanding fees across the whole school — same effective-
 * balance logic used in Analytics.tsx's feeStatusBreakdown and
 * useChildDashboardStats, computed school-wide for the accountant
 * dashboard's stat card. */
export function useOutstandingFeesTotal() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['outstanding-fees-total', schoolId],
    queryFn: async (): Promise<number> => {
      const [feesRes, paymentsRes] = await Promise.all([
        supabase.from('student_fees').select('student_id, custom_amount, waived, fee_structures (amount)'),
        supabase.from('payments').select('student_id, amount').eq('status', 'confirmed'),
      ]);
      if (feesRes.error) throw feesRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const owedByStudent: Record<string, number> = {};
      (feesRes.data || []).forEach((line: any) => {
        if (line.waived) return;
        const amount = line.custom_amount ?? line.fee_structures?.amount ?? 0;
        owedByStudent[line.student_id] = (owedByStudent[line.student_id] || 0) + amount;
      });
      const paidByStudent: Record<string, number> = {};
      (paymentsRes.data || []).forEach((p: any) => {
        if (!p.student_id) return;
        paidByStudent[p.student_id] = (paidByStudent[p.student_id] || 0) + Number(p.amount);
      });

      return Object.entries(owedByStudent).reduce(
        (sum, [studentId, owed]) => sum + Math.max(owed - (paidByStudent[studentId] || 0), 0),
        0
      );
    },
    enabled: !!schoolId,
  });
}

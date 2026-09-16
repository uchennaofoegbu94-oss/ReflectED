import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface StudentFeeLine {
  id: string;
  student_id: string;
  fee_structure_id: string;
  custom_amount: number | null;
  waived: boolean;
  waived_reason: string | null;
  auto_generated: boolean;
  fee_structures: { id: string; description: string; amount: number; term_id: string | null } | null;
  /** amount actually owed for this line, after waive/override */
  effective_amount: number;
}

export interface StudentBalance {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_name: string;
  total_owed: number;
  total_paid: number;
  balance: number;
  lines: StudentFeeLine[];
}

function computeEffective(line: { custom_amount: number | null; waived: boolean; fee_structures: { amount: number } | null }) {
  if (line.waived) return 0;
  return line.custom_amount ?? line.fee_structures?.amount ?? 0;
}

/** Per-student owed/paid/balance, across every fee line they're
 * assigned (auto-generated from class/school-wide fee_structures, or
 * added individually by an admin). This is what "Pending" on the Fees
 * page should mean — money not yet paid — as opposed to the older
 * payments-status meaning of "transactions awaiting confirmation." */
export function useStudentFeeBalances() {
  return useQuery({
    queryKey: ['student-fee-balances'],
    queryFn: async (): Promise<StudentBalance[]> => {
      const [{ data: fees, error: feesError }, { data: payments, error: paymentsError }] = await Promise.all([
        supabase
          .from('student_fees')
          .select(`
            id, student_id, fee_structure_id, custom_amount, waived, waived_reason, auto_generated,
            fee_structures (id, description, amount, term_id),
            students (id, first_name, last_name, admission_number, class_arms (name, arm))
          `),
        supabase
          .from('payments')
          .select('student_id, fee_id, amount')
          .eq('status', 'confirmed'),
      ]);

      if (feesError) throw feesError;
      if (paymentsError) throw paymentsError;

      const paidByStudentFee = new Map<string, number>();
      (payments || []).forEach((p) => {
        const key = `${p.student_id}:${p.fee_id}`;
        paidByStudentFee.set(key, (paidByStudentFee.get(key) || 0) + Number(p.amount));
      });

      const byStudent = new Map<string, StudentBalance>();
      (fees || []).forEach((row: any) => {
        const student = row.students;
        if (!student) return;
        const effective = computeEffective(row);
        const paidKey = `${row.student_id}:${row.fee_structure_id}`;
        const paidForLine = paidByStudentFee.get(paidKey) || 0;

        if (!byStudent.has(row.student_id)) {
          byStudent.set(row.student_id, {
            student_id: row.student_id,
            first_name: student.first_name,
            last_name: student.last_name,
            admission_number: student.admission_number,
            class_name: student.class_arms ? `${student.class_arms.name} ${student.class_arms.arm || ''}`.trim() : '',
            total_owed: 0,
            total_paid: 0,
            balance: 0,
            lines: [],
          });
        }

        const entry = byStudent.get(row.student_id)!;
        entry.total_owed += effective;
        entry.total_paid += Math.min(paidForLine, effective); // don't let overpayment on one fee mask a debt on another
        entry.lines.push({
          id: row.id,
          student_id: row.student_id,
          fee_structure_id: row.fee_structure_id,
          custom_amount: row.custom_amount,
          waived: row.waived,
          waived_reason: row.waived_reason,
          auto_generated: row.auto_generated,
          fee_structures: row.fee_structures,
          effective_amount: effective,
        });
      });

      return Array.from(byStudent.values())
        .map(s => ({ ...s, balance: Math.max(0, s.total_owed - s.total_paid) }))
        .sort((a, b) => b.balance - a.balance);
    },
  });
}

export function useStudentFees(studentId?: string) {
  return useQuery({
    queryKey: ['student-fees', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      const { data, error } = await supabase
        .from('student_fees')
        .select(`
          id, student_id, fee_structure_id, custom_amount, waived, waived_reason, auto_generated,
          fee_structures (id, description, amount, term_id)
        `)
        .eq('student_id', studentId);
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        effective_amount: computeEffective(row),
      })) as StudentFeeLine[];
    },
    enabled: !!studentId,
  });
}

/** Admin-only (enforced by RLS) — waive a specific student's fee, with
 * an optional reason for the record. */
export function useWaiveStudentFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, waived, reason }: { id: string; waived: boolean; reason?: string }) => {
      const { error } = await supabase
        .from('student_fees')
        .update({ waived, waived_reason: waived ? reason || null : null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balances'] });
      toast.success('Updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admin-only — override the amount for one student on one fee,
 * without touching the shared fee_structures record other students
 * are billed against. Pass null to clear the override and fall back
 * to the standard amount. */
export function useOverrideStudentFeeAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number | null }) => {
      const { error } = await supabase
        .from('student_fees')
        .update({ custom_amount: amount })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balances'] });
      toast.success('Amount updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admin-only — manually assign an existing fee_structure to one
 * student who wouldn't otherwise be auto-billed for it (e.g. a fee
 * tied to a different class that still applies to this student). */
export function useAddStudentFee() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ studentId, feeStructureId }: { studentId: string; feeStructureId: string }) => {
      const { error } = await supabase.from('student_fees').insert({
        student_id: studentId,
        fee_structure_id: feeStructureId,
        auto_generated: false,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balances'] });
      toast.success('Fee added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admin-only — fully remove a fee assignment from a student (distinct
 * from waiving: this deletes the record entirely, e.g. to undo a
 * mistaken manual add). */
export function useRemoveStudentFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('student_fees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-fees'] });
      queryClient.invalidateQueries({ queryKey: ['student-fee-balances'] });
      toast.success('Fee removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

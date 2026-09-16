import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Users, ClipboardCheck, CreditCard, FileText, LucideIcon } from 'lucide-react';

interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  time: string;
  /** Raw timestamp used for sorting. `time` is the human-readable
   * "X ago" string derived from this — never sort by `time` itself,
   * string comparison of relative-time text doesn't order correctly
   * (e.g. "10 minutes ago" < "2 minutes ago" alphabetically). */
  timestamp: number;
  icon: LucideIcon;
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: async (): Promise<ActivityItem[]> => {
      const activities: ActivityItem[] = [];

      // Fetch recent data in parallel
      const [studentsResult, attendanceResult, paymentsResult, submissionsResult] = await Promise.all([
        // Recent students enrolled (last 5)
        supabase
          .from('students')
          .select('id, first_name, last_name, created_at, class_arms(name)')
          .order('created_at', { ascending: false })
          .limit(3),
        
        // Recent attendance records
        supabase
          .from('attendance_records')
          .select('id, status, created_at, students(first_name, last_name, class_arms(name))')
          .order('created_at', { ascending: false })
          .limit(3),
        
        // Recent payments
        supabase
          .from('payments')
          .select('id, amount, created_at, students(first_name, last_name)')
          .eq('status', 'confirmed')
          .order('created_at', { ascending: false })
          .limit(3),

        // Recent submissions
        supabase
          .from('submissions')
          .select('id, submitted_at, assignments(title), students(first_name, last_name)')
          .order('submitted_at', { ascending: false })
          .limit(3),
      ]);

      // Process students
      if (studentsResult.data) {
        studentsResult.data.forEach((student) => {
          const className = (student.class_arms as any)?.name || 'Unassigned';
          activities.push({
            id: `student-${student.id}`,
            action: 'New student enrolled',
            detail: `${student.first_name} ${student.last_name} added to ${className}`,
            time: formatDistanceToNow(new Date(student.created_at), { addSuffix: true }),
            timestamp: new Date(student.created_at).getTime(),
            icon: Users,
          });
        });
      }

      // Process attendance
      if (attendanceResult.data) {
        const grouped = attendanceResult.data.reduce((acc, record) => {
          const date = new Date(record.created_at).toDateString();
          if (!acc[date]) acc[date] = { present: 0, absent: 0, late: 0, time: record.created_at };
          if (record.status === 'present') acc[date].present++;
          else if (record.status === 'absent') acc[date].absent++;
          else if (record.status === 'late') acc[date].late++;
          return acc;
        }, {} as Record<string, { present: number; absent: number; late: number; time: string }>);

        Object.entries(grouped).slice(0, 2).forEach(([_, data]) => {
          activities.push({
            id: `attendance-${data.time}`,
            action: 'Attendance marked',
            detail: `${data.present} present, ${data.absent} absent, ${data.late} late`,
            time: formatDistanceToNow(new Date(data.time), { addSuffix: true }),
            timestamp: new Date(data.time).getTime(),
            icon: ClipboardCheck,
          });
        });
      }

      // Process payments
      if (paymentsResult.data) {
        paymentsResult.data.forEach((payment) => {
          const student = payment.students as any;
          const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(Number(payment.amount));
          activities.push({
            id: `payment-${payment.id}`,
            action: 'Fee payment received',
            detail: `${amount} from ${student?.first_name || 'Unknown'} ${student?.last_name || ''}`,
            time: formatDistanceToNow(new Date(payment.created_at), { addSuffix: true }),
            timestamp: new Date(payment.created_at).getTime(),
            icon: CreditCard,
          });
        });
      }

      // Process submissions
      if (submissionsResult.data) {
        submissionsResult.data.forEach((submission) => {
          const student = submission.students as any;
          const assignment = submission.assignments as any;
          activities.push({
            id: `submission-${submission.id}`,
            action: 'Assignment submitted',
            detail: `${student?.first_name || 'Student'} submitted "${assignment?.title || 'Assignment'}"`,
            time: formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true }),
            timestamp: new Date(submission.submitted_at).getTime(),
            icon: FileText,
          });
        });
      }

      // Sort by the real timestamp, most recent first — sorting by the
      // formatted "X ago" string instead (as this used to) is wrong:
      // string comparison orders "10 minutes ago" before "2 minutes ago".
      return activities
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 6);
    },
  });
}

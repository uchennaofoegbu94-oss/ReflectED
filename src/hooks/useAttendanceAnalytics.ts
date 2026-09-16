import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolId } from './useSchoolId';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface StudentAttendanceFilters {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  classId?: string | null;
}

export interface StudentAttendanceRow {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  counts: Record<AttendanceStatus, number>;
  total: number;
}

export interface StudentAttendanceAnalytics {
  byDate: { date: string; present: number; absent: number; late: number; excused: number }[];
  byStatus: Record<AttendanceStatus, number>;
  byStudent: StudentAttendanceRow[];
  totalRecords: number;
}

/**
 * Student attendance analytics for a date range, optionally scoped to a single
 * class. RLS (Batch 3) already limits what a teacher can see to their own form
 * class — this hook just aggregates whatever attendance_records rows come back,
 * so no separate client-side scoping is needed beyond the classId filter itself.
 */
export function useStudentAttendanceAnalytics(filters: StudentAttendanceFilters) {
  const schoolId = useSchoolId();

  return useQuery({
    queryKey: ['attendance-analytics-students', schoolId, filters.from, filters.to, filters.classId],
    queryFn: async (): Promise<StudentAttendanceAnalytics> => {
      let query = supabase
        .from('attendance_records')
        .select('id, student_id, date, status, students!inner(id, admission_number, first_name, last_name, class_id)')
        .gte('date', filters.from)
        .lte('date', filters.to);

      if (filters.classId) {
        query = query.eq('students.class_id', filters.classId);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as any[];

      const byDateMap = new Map<string, { present: number; absent: number; late: number; excused: number }>();
      const byStatus: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
      const byStudentMap = new Map<string, StudentAttendanceRow>();

      for (const row of rows) {
        const status = row.status as AttendanceStatus;
        byStatus[status] = (byStatus[status] || 0) + 1;

        if (!byDateMap.has(row.date)) {
          byDateMap.set(row.date, { present: 0, absent: 0, late: 0, excused: 0 });
        }
        byDateMap.get(row.date)![status] += 1;

        const stu = row.students;
        if (stu) {
          if (!byStudentMap.has(stu.id)) {
            byStudentMap.set(stu.id, {
              id: stu.id,
              admission_number: stu.admission_number,
              first_name: stu.first_name,
              last_name: stu.last_name,
              class_id: stu.class_id,
              counts: { present: 0, absent: 0, late: 0, excused: 0 },
              total: 0,
            });
          }
          const entry = byStudentMap.get(stu.id)!;
          entry.counts[status] += 1;
          entry.total += 1;
        }
      }

      const byDate = Array.from(byDateMap.entries())
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        byDate,
        byStatus,
        byStudent: Array.from(byStudentMap.values()).sort((a, b) => a.last_name.localeCompare(b.last_name)),
        totalRecords: rows.length,
      };
    },
    enabled: !!schoolId && !!filters.from && !!filters.to,
  });
}

export interface StaffAttendanceFilters {
  from: string;
  to: string;
}

export interface StaffAttendanceRow {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  daysClocked: number;
  totalHours: number;
  avgClockInMinutesPastMidnight: number | null;
}

export interface StaffAttendanceAnalytics {
  byDate: { date: string; clockIns: number }[];
  byStaff: StaffAttendanceRow[];
  totalRecords: number;
}

/** Staff clock-record analytics for a date range. Admin/principal only — gated
 * by where this hook is called from, not by RLS (staff_clock_records is broadly
 * staff-readable by design, per the existing self/admin-scan clock-in feature). */
export function useStaffAttendanceAnalytics(filters: StaffAttendanceFilters, enabled = true) {
  const schoolId = useSchoolId();

  return useQuery({
    queryKey: ['attendance-analytics-staff', schoolId, filters.from, filters.to],
    queryFn: async (): Promise<StaffAttendanceAnalytics> => {
      const { data, error } = await supabase
        .from('staff_clock_records' as any)
        .select('id, staff_id, date, clock_in, clock_out, staff:staff_id(id, employee_id, first_name, last_name)')
        .gte('date', filters.from)
        .lte('date', filters.to);
      if (error) throw error;
      const rows = (data || []) as any[];

      const byDateMap = new Map<string, number>();
      const byStaffMap = new Map<string, StaffAttendanceRow & { _minutesSum: number; _minutesCount: number; _hoursSum: number }>();

      for (const row of rows) {
        byDateMap.set(row.date, (byDateMap.get(row.date) || 0) + 1);

        const stf = row.staff;
        if (!stf) continue;
        if (!byStaffMap.has(stf.id)) {
          byStaffMap.set(stf.id, {
            id: stf.id,
            employee_id: stf.employee_id,
            first_name: stf.first_name,
            last_name: stf.last_name,
            daysClocked: 0,
            totalHours: 0,
            avgClockInMinutesPastMidnight: null,
            _minutesSum: 0,
            _minutesCount: 0,
            _hoursSum: 0,
          });
        }
        const entry = byStaffMap.get(stf.id)!;
        entry.daysClocked += 1;

        if (row.clock_in) {
          const clockInDate = new Date(row.clock_in);
          entry._minutesSum += clockInDate.getHours() * 60 + clockInDate.getMinutes();
          entry._minutesCount += 1;
        }
        if (row.clock_in && row.clock_out) {
          const hours = (new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime()) / (1000 * 60 * 60);
          if (hours > 0) entry._hoursSum += hours;
        }
      }

      const byStaff: StaffAttendanceRow[] = Array.from(byStaffMap.values())
        .map((e) => ({
          id: e.id,
          employee_id: e.employee_id,
          first_name: e.first_name,
          last_name: e.last_name,
          daysClocked: e.daysClocked,
          totalHours: Math.round(e._hoursSum * 10) / 10,
          avgClockInMinutesPastMidnight: e._minutesCount > 0 ? Math.round(e._minutesSum / e._minutesCount) : null,
        }))
        .sort((a, b) => a.last_name.localeCompare(b.last_name));

      const byDate = Array.from(byDateMap.entries())
        .map(([date, clockIns]) => ({ date, clockIns }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { byDate, byStaff, totalRecords: rows.length };
    },
    enabled: enabled && !!schoolId && !!filters.from && !!filters.to,
  });
}

export function formatMinutesAsTime(minutes: number | null): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Day-by-day record list for a single student, fetched on demand for drill-down. */
export function useStudentAttendanceDrilldown(studentId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['attendance-drilldown-student', studentId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('date, status, period, method')
        .eq('student_id', studentId!)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId && !!from && !!to,
  });
}

/** Day-by-day clock records for a single staff member, fetched on demand for drill-down. */
export function useStaffAttendanceDrilldown(staffId: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ['attendance-drilldown-staff', staffId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_clock_records' as any)
        .select('date, clock_in, clock_out, method')
        .eq('staff_id', staffId!)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!staffId && !!from && !!to,
  });
}

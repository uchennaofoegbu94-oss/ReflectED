import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useSchoolId, withSchoolId } from './useSchoolId';
import { useAuth } from '@/contexts/AuthContext';

type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row'];
type AttendanceInsert = Database['public']['Tables']['attendance_records']['Insert'];
type AttendanceStatus = Database['public']['Enums']['attendance_status'];

export interface AttendanceWithStudent extends AttendanceRecord {
  students: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    admission_number: string;
  } | null;
}

export interface AttendanceSession {
  id: string;
  school_id: string;
  class_id: string | null;
  date: string;
  period: number | null;
  status: 'open' | 'submitted' | 'locked';
  submitted_at: string | null;
  submitted_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
}

export function useAttendanceByDate(date: string, classId?: string) {
  return useQuery({
    queryKey: ['attendance', date, classId],
    queryFn: async (): Promise<AttendanceWithStudent[]> => {
      let query = supabase
        .from('attendance_records')
        .select(`
          *,
          students (
            id,
            first_name,
            last_name,
            avatar_url,
            admission_number
          )
        `)
        .eq('date', date);

      if (classId) {
        query = query.eq('students.class_id', classId);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!date,
  });
}

/** Finds the attendance session for this class/date/period, if one
 * already exists. Does not create one — marking attendance for the
 * first time on a given day has no session yet, and that's a valid
 * "nothing to lock" state, not an error. */
export function useAttendanceSession(classId: string | undefined, date: string, period: number | null = null) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['attendance-session', schoolId, classId, date, period],
    queryFn: async (): Promise<AttendanceSession | null> => {
      if (!schoolId || !classId) return null;
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_id', classId)
        .eq('date', date)
        .is('period', period)
        .maybeSingle();
      if (error) throw error;
      return data as AttendanceSession | null;
    },
    enabled: !!schoolId && !!classId && !!date,
  });
}

/** Saves attendance for a class/date/period. Behavior depends on who's
 * saving:
 *  - Teacher: creates the session (if needed) and immediately marks it
 *    'submitted' in the same save — per spec, a teacher's save is what
 *    locks it. Fails closed if the session is already locked (RLS would
 *    reject the writes anyway; this surfaces a clear error instead of a
 *    confusing partial-save).
 *  - Admin/Principal: saves without changing lock state, so their edits
 *    don't accidentally re-lock a session a teacher is actively working
 *    on after an unlock.
 */
export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  return useMutation({
    mutationFn: async (params: {
      classId: string;
      date: string;
      period?: number | null;
      records: Array<{ student_id: string; status: AttendanceStatus }>;
    }) => {
      if (!schoolId) throw new Error('No school context.');
      const period = params.period ?? null;

      // Find or create the session for this class/date/period.
      const { data: existing, error: findErr } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('class_id', params.classId)
        .eq('date', params.date)
        .is('period', period)
        .maybeSingle();
      if (findErr) throw findErr;

      let session = existing as AttendanceSession | null;
      if (!session) {
        const { data: created, error: createErr } = await supabase
          .from('attendance_sessions')
          .insert(withSchoolId({
            class_id: params.classId,
            date: params.date,
            period,
            created_by: user?.id,
          }, schoolId))
          .select()
          .single();
        if (createErr) throw createErr;
        session = created as AttendanceSession;
      } else if (!isAdmin && session.status !== 'open') {
        throw new Error('This attendance session is locked. Ask an Admin/Principal to unlock it before making changes.');
      }

      const recordsWithSchool: AttendanceInsert[] = params.records.map(r => ({
        student_id: r.student_id,
        date: params.date,
        period,
        status: r.status,
        marked_by: user?.id,
        session_id: session!.id,
        school_id: schoolId,
      }));

      const { data, error } = await supabase
        .from('attendance_records')
        .upsert(recordsWithSchool, {
          onConflict: 'student_id,date,period',
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;

      // Teacher save = submit = lock, in the same action.
      if (!isAdmin && session.status === 'open') {
        const { error: submitErr } = await supabase
          .from('attendance_sessions')
          .update({ status: 'submitted', submitted_at: new Date().toISOString(), submitted_by: user?.id })
          .eq('id', session.id);
        if (submitErr) throw submitErr;
        await supabase.from('attendance_audit').insert(withSchoolId({
          session_id: session.id,
          action: 'submit',
          performed_by: user?.id,
        }, schoolId));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-session'] });
    },
  });
}

/** Admin/Principal only — RLS enforces this independently, this is the
 * UI-facing action. Reopens a submitted/locked session so a teacher can
 * make corrections and re-save (which locks it again). */
export function useUnlockAttendanceSession() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ status: 'open', locked_at: null, locked_by: null })
        .eq('id', sessionId);
      if (error) throw error;

      if (schoolId) {
        await supabase.from('attendance_audit').insert(withSchoolId({
          session_id: sessionId,
          action: 'unlock',
          performed_by: user?.id,
        }, schoolId));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session'] });
    },
  });
}

export function useStudentsForAttendance(classId?: string) {
  return useQuery({
    queryKey: ['students_attendance', classId],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('id, first_name, last_name, avatar_url, admission_number, class_id')
        .eq('enrollment_status', 'active');

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query.order('last_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}

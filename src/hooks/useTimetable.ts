import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useSchoolId } from './useSchoolId';

type TimetableSlot = Database['public']['Tables']['timetable_slots']['Row'];
type TimetableSlotInsert = Database['public']['Tables']['timetable_slots']['Insert'];
type TimetableSlotUpdate = Database['public']['Tables']['timetable_slots']['Update'];

export interface TimetableSlotWithDetails extends TimetableSlot {
  subjects: {
    id: string;
    name: string;
    code: string;
  } | null;
  class_arms: {
    id: string;
    name: string;
    arm: string;
  } | null;
  staff: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export function useTimetableSlots(classId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['timetable_slots', schoolId, classId],
    queryFn: async (): Promise<TimetableSlotWithDetails[]> => {
      let query = supabase
        .from('timetable_slots')
        .select(`
          *,
          subjects (
            id,
            name,
            code
          ),
          class_arms (
            id,
            name,
            arm
          ),
          staff (
            id,
            first_name,
            last_name
          )
        `)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as TimetableSlotWithDetails[];
    },
    enabled: !!schoolId,
  });
}

export function useTeacherTimetable(teacherId?: string) {
  return useQuery({
    queryKey: ['timetable_slots', 'teacher', teacherId],
    queryFn: async (): Promise<TimetableSlotWithDetails[]> => {
      if (!teacherId) return [];

      const { data, error } = await supabase
        .from('timetable_slots')
        .select(`
          *,
          subjects (
            id,
            name,
            code
          ),
          class_arms (
            id,
            name,
            arm
          ),
          staff (
            id,
            first_name,
            last_name
          )
        `)
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data || []) as TimetableSlotWithDetails[];
    },
    enabled: !!teacherId,
  });
}

export function useCreateTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slot: TimetableSlotInsert) => {
      const { data, error } = await supabase
        .from('timetable_slots')
        .insert(slot)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable_slots'] });
    },
  });
}

export function useUpdateTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...update }: TimetableSlotUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('timetable_slots')
        .update(update)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable_slots'] });
    },
  });
}

export function useDeleteTimetableSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('timetable_slots')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable_slots'] });
    },
  });
}

/** Distinct classes a teacher has any timetable slot in — used to scope
 * a teacher's "By Class" selector to only the classes they actually
 * teach, instead of every class in the school. */
export function useMyTeachingClassIds(teacherId?: string) {
  return useQuery({
    queryKey: ['timetable_slots', 'teacher-class-ids', teacherId],
    queryFn: async (): Promise<string[]> => {
      if (!teacherId) return [];
      const { data, error } = await supabase
        .from('timetable_slots')
        .select('class_id')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);
      if (error) throw error;
      return Array.from(new Set((data || []).map(r => r.class_id).filter(Boolean) as string[]));
    },
    enabled: !!teacherId,
  });
}

/** The logged-in student's own class_id — used to lock the student view
 * of Timetable to just their own class, with no selector. */
export function useMyStudentClassId() {
  return useQuery({
    queryKey: ['my-student-class-id'],
    queryFn: async (): Promise<string | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return null;
      const { data, error } = await supabase
        .from('students')
        .select('class_id')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.class_id ?? null;
    },
  });
}

export const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
];

export const TIME_SLOTS = [
  { start: '08:00', end: '08:45', label: '8:00 - 8:45 AM' },
  { start: '08:45', end: '09:30', label: '8:45 - 9:30 AM' },
  { start: '09:30', end: '10:15', label: '9:30 - 10:15 AM' },
  { start: '10:15', end: '10:30', label: '10:15 - 10:30 AM (Break)' },
  { start: '10:30', end: '11:15', label: '10:30 - 11:15 AM' },
  { start: '11:15', end: '12:00', label: '11:15 - 12:00 PM' },
  { start: '12:00', end: '12:45', label: '12:00 - 12:45 PM' },
  { start: '12:45', end: '13:30', label: '12:45 - 1:30 PM (Lunch)' },
  { start: '13:30', end: '14:15', label: '1:30 - 2:15 PM' },
  { start: '14:15', end: '15:00', label: '2:15 - 3:00 PM' },
];

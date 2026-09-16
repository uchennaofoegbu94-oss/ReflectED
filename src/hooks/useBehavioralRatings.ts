import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolId } from './useSchoolId';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BehavioralTrait {
  id: string;
  domain: 'affective' | 'psychomotor';
  name: string;
  trait_order: number;
  is_active: boolean;
}

/** Fetches this school's trait list, seeding sensible defaults the
 * first time (idempotent — safe to call on every load). */
export function useBehavioralTraits() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['behavioral-traits', schoolId],
    queryFn: async (): Promise<BehavioralTrait[]> => {
      if (!schoolId) return [];

      const { data: existing, error: fetchErr } = await supabase
        .from('behavioral_traits')
        .select('id, domain, name, trait_order, is_active')
        .eq('is_active', true)
        .order('domain')
        .order('trait_order');
      if (fetchErr) throw fetchErr;

      if (existing && existing.length > 0) return existing as BehavioralTrait[];

      // Nothing yet for this school — seed defaults, then re-fetch.
      const { error: seedErr } = await supabase.rpc('ensure_default_behavioral_traits', {
        p_school_id: schoolId,
      });
      if (seedErr) throw seedErr;

      const { data: seeded, error: refetchErr } = await supabase
        .from('behavioral_traits')
        .select('id, domain, name, trait_order, is_active')
        .eq('is_active', true)
        .order('domain')
        .order('trait_order');
      if (refetchErr) throw refetchErr;
      return (seeded || []) as BehavioralTrait[];
    },
    enabled: !!schoolId,
  });
}

/** Admin-only (RLS-enforced) trait CRUD, for schools that want to
 * rename/add/remove traits from the seeded defaults. */
export function useCreateBehavioralTrait() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { domain: 'affective' | 'psychomotor'; name: string; trait_order?: number }) => {
      const { error } = await supabase.from('behavioral_traits').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-traits'] });
      toast.success('Trait added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBehavioralTrait() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; is_active?: boolean; trait_order?: number }) => {
      const { error } = await supabase.from('behavioral_traits').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-traits'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** All ratings for a class/term, keyed for grid display. */
export function useClassBehavioralRatings(classId?: string, termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['behavioral-ratings', classId, termId, schoolId],
    queryFn: async () => {
      if (!classId || !termId) return [];
      const { data: students, error: studentsErr } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');
      if (studentsErr) throw studentsErr;
      const studentIds = (students || []).map(s => s.id);
      if (studentIds.length === 0) return [];

      const { data, error } = await supabase
        .from('student_behavioral_ratings')
        .select('id, student_id, term_id, trait_id, rating')
        .eq('term_id', termId)
        .in('student_id', studentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!classId && !!termId && !!schoolId,
  });
}

/** Ratings for a single student in a single term, grouped by domain —
 * this is what the report card reads from. */
export function useStudentBehavioralRatings(studentId?: string, termId?: string) {
  return useQuery({
    queryKey: ['student-behavioral-ratings', studentId, termId],
    queryFn: async () => {
      if (!studentId || !termId) return [];
      const { data, error } = await supabase
        .from('student_behavioral_ratings')
        .select('trait_id, rating, behavioral_traits (id, domain, name, trait_order)')
        .eq('student_id', studentId)
        .eq('term_id', termId);
      if (error) throw error;
      return (data || []) as Array<{ trait_id: string; rating: number; behavioral_traits: BehavioralTrait }>;
    },
    enabled: !!studentId && !!termId,
  });
}

export function useSetBehavioralRating() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ studentId, termId, traitId, rating }: {
      studentId: string; termId: string; traitId: string; rating: number;
    }) => {
      const { error } = await supabase
        .from('student_behavioral_ratings')
        .upsert(
          { student_id: studentId, term_id: termId, trait_id: traitId, rating, rated_by: user?.id },
          { onConflict: 'student_id,term_id,trait_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['behavioral-ratings'] });
      queryClient.invalidateQueries({ queryKey: ['student-behavioral-ratings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AcademicSession = Database['public']['Tables']['academic_sessions']['Row'];
type Term = Database['public']['Tables']['terms']['Row'];

export function useAcademicSessions() {
  return useQuery({
    queryKey: ['academic_sessions'],
    queryFn: async (): Promise<AcademicSession[]> => {
      const { data, error } = await supabase
        .from('academic_sessions')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useActiveSession() {
  return useQuery({
    queryKey: ['academic_sessions', 'active'],
    queryFn: async (): Promise<AcademicSession | null> => {
      const { data, error } = await supabase
        .from('academic_sessions')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function useTerms(sessionId?: string) {
  return useQuery({
    queryKey: ['terms', sessionId],
    queryFn: async (): Promise<Term[]> => {
      let query = supabase
        .from('terms')
        .select('*')
        .order('term_number', { ascending: true });

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });
}

export function useActiveTerm() {
  return useQuery({
    queryKey: ['terms', 'active'],
    queryFn: async (): Promise<Term | null> => {
      const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

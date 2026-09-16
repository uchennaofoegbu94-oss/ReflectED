import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Resolves the current authenticated user's staff.id (null for non-staff users,
 * or staff without a linked row). Cached per user id.
 */
export function useMyStaffId() {
  const { user } = useAuth();
  const isStaffRole = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';

  return useQuery({
    queryKey: ['my-staff-id', user?.id],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!user?.id && isStaffRole,
  });
}

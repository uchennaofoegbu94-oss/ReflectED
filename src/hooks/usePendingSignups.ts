import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type AppRole = Database['public']['Enums']['app_role'];

export interface PendingSignup {
  user_id: string;
  role: AppRole;
  school_id: string | null;
  created_at: string;
  profile: {
    full_name: string;
    email: string | null;
  } | null;
}

// RLS ("Reviewers view pending signups") already scopes this to what the
// caller is allowed to see — their own school's pending student/teacher/
// accountant signups for an admin/principal, every school's for a
// super-admin — so no extra filtering is needed here.
export function usePendingSignups() {
  return useQuery({
    queryKey: ['pending-signups'],
    queryFn: async (): Promise<PendingSignup[]> => {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('user_id, role, school_id, created_at')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!roles || roles.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', roles.map(r => r.user_id));

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      return roles.map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) || null,
      }));
    },
  });
}

// Wraps the review_signup RPC (approve/reject, optionally reassigning the
// role first) — all the authorization and student/staff table bookkeeping
// happens server-side in one transaction; see the migration.
export function useReviewSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: string; decision: 'approve' | 'reject'; newRole?: AppRole }) => {
      const { error } = await supabase.rpc('review_signup', {
        _target_user_id: params.userId,
        _decision: params.decision,
        _new_role: params.newRole,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pending-signups'] });
      toast.success(variables.decision === 'approve' ? 'Signup approved' : 'Signup rejected');
    },
    onError: (error: any) => toast.error('Failed to review signup: ' + error.message),
  });
}

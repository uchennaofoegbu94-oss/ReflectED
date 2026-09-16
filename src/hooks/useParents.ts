import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolId } from '@/hooks/useSchoolId';
import { toast } from 'sonner';

export interface ParentChildSummary {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
}

export interface ParentWithChildren {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  children: ParentChildSummary[];
}

/** Admin-facing parent directory — previously there was no way to see
 * which parent accounts exist, which are linked to which children, or
 * spot unlinked/orphaned ones. Mirrors the Students/Teachers list
 * pattern. A "parent" is just a user_roles row (role='parent') plus a
 * profiles row — there's no dedicated parents table, so this assembles
 * the view from both plus students.parent_id. */
export function useAllParents() {
  const schoolId = useSchoolId();

  return useQuery({
    queryKey: ['all-parents', schoolId],
    queryFn: async (): Promise<ParentWithChildren[]> => {
      if (!schoolId) return [];

      const { data: parentRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'parent')
        .eq('school_id', schoolId);
      if (rolesError) throw rolesError;

      const parentIds = (parentRoles || []).map(r => r.user_id);
      if (parentIds.length === 0) return [];

      const [profilesRes, studentsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, full_name, email, phone, avatar_url, created_at')
          .in('user_id', parentIds),
        supabase
          .from('students')
          .select('id, first_name, last_name, admission_number, parent_id')
          .in('parent_id', parentIds),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (studentsRes.error) throw studentsRes.error;

      const childrenByParent: Record<string, ParentChildSummary[]> = {};
      (studentsRes.data || []).forEach((s: any) => {
        if (!s.parent_id) return;
        (childrenByParent[s.parent_id] ||= []).push({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          admission_number: s.admission_number,
        });
      });

      const profileByUserId = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));

      return parentIds.map((userId) => {
        const profile = profileByUserId.get(userId);
        return {
          user_id: userId,
          full_name: profile?.full_name || 'Unnamed parent',
          email: profile?.email ?? null,
          phone: profile?.phone ?? null,
          avatar_url: profile?.avatar_url ?? null,
          created_at: profile?.created_at || '',
          children: childrenByParent[userId] || [],
        };
      });
    },
    enabled: !!schoolId,
  });
}

/** Admin override for unlinking a child from a parent — the existing
 * unlink_child_from_parent RPC is hardcoded to `WHERE parent_id =
 * auth.uid()`, i.e. only the parent themselves can call it. This is a
 * plain table update instead, relying on the same students-table RLS
 * that already lets admin/principal edit a student's other fields. */
export function useAdminUnlinkChild() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .update({ parent_id: null })
        .eq('id', studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-parents', schoolId] });
      toast.success('Child unlinked from parent');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unlink child');
    },
  });
}

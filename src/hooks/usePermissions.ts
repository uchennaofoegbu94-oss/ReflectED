import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolId } from './useSchoolId';
import { useMyStaffId } from './useMyStaffId';
import { toast } from 'sonner';

export type PermissionKey =
  | 'manage_staff'
  | 'manage_announcements'
  | 'manage_fees'
  | 'view_audit_log'
  | 'manage_school_settings'
  | 'generate_reports'
  | 'unlock_attendance'
  | 'manage_special_roles'
  | 'view_all_timetables';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  manage_staff: 'Manage Staff (invite/edit)',
  manage_announcements: 'Manage Announcements',
  manage_fees: 'Manage Fees',
  view_audit_log: 'View Audit Log',
  manage_school_settings: 'Manage School Settings',
  generate_reports: 'Generate Reports',
  unlock_attendance: 'Unlock Attendance Sessions',
  manage_special_roles: 'Manage Special Roles/Badges',
  view_all_timetables: 'View All Timetables (by class and by teacher)',
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

export interface PermissionGrant {
  id: string;
  staff_id: string;
  permission: PermissionKey;
  granted_by: string | null;
  granted_at: string;
  staff?: { first_name: string; last_name: string; employee_id: string } | null;
}

/** Permissions delegated to the current logged-in staff member. */
export function useMyPermissions() {
  const { data: myStaffId } = useMyStaffId();
  return useQuery({
    queryKey: ['my-permissions', myStaffId],
    queryFn: async (): Promise<Set<PermissionKey>> => {
      if (!myStaffId) return new Set();
      const { data, error } = await supabase
        .from('permission_grants' as any)
        .select('permission')
        .eq('staff_id', myStaffId);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.permission as PermissionKey));
    },
    enabled: !!myStaffId,
  });
}

/**
 * True if the current user is admin/principal OR has been delegated the given
 * permission. Use this wherever a feature previously checked
 * `user?.role === 'admin' || user?.role === 'principal'` directly, to also
 * honor #11's delegated-permission grants.
 */
export function useHasPermission(permission: PermissionKey) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const { data: myPermissions } = useMyPermissions();
  return isAdmin || !!myPermissions?.has(permission);
}

/** All permission grants for the school — admin/principal management view. */
export function useAllPermissionGrants() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['permission-grants', schoolId],
    queryFn: async (): Promise<PermissionGrant[]> => {
      const { data, error } = await supabase
        .from('permission_grants' as any)
        .select('id, staff_id, permission, granted_by, granted_at, staff:staff_id(first_name, last_name, employee_id)')
        .order('granted_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PermissionGrant[];
    },
    enabled: !!schoolId,
  });
}

/** Grants one or more permissions to one or more staff at once. */
export function useGrantPermissions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ staffIds, permissions }: { staffIds: string[]; permissions: PermissionKey[] }) => {
      const rows = staffIds.flatMap((staffId) =>
        permissions.map((permission) => ({ staff_id: staffId, permission, granted_by: user?.id }))
      );
      const { error } = await supabase
        .from('permission_grants' as any)
        .upsert(rows, { onConflict: 'staff_id,permission', ignoreDuplicates: true });
      if (error) throw error;

      try {
        await supabase.from('audit_log' as any).insert({
          user_id: user?.id,
          user_name: user?.name || null,
          action: 'grant',
          entity_type: 'permission_grant',
          details: { staff_ids: staffIds, permissions },
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-grants'] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
      toast.success('Permissions granted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to grant permissions'),
  });
}

export function useRevokePermission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (grant: { id: string; staff_id: string; permission: PermissionKey }) => {
      const { error } = await supabase
        .from('permission_grants' as any)
        .delete()
        .eq('id', grant.id);
      if (error) throw error;

      try {
        await supabase.from('audit_log' as any).insert({
          user_id: user?.id,
          user_name: user?.name || null,
          action: 'revoke',
          entity_type: 'permission_grant',
          entity_id: grant.staff_id,
          details: { permission: grant.permission },
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-grants'] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
      toast.success('Permission revoked');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to revoke permission'),
  });
}

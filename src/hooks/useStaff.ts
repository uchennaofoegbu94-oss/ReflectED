import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolId, withSchoolId } from './useSchoolId';

export interface Staff {
  id: string;
  user_id: string | null;
  employee_id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  email: string;
  phone: string | null;
  gender: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  qualification: string | null;
  employment_date: string | null;
  employment_status: string;
  created_at: string;
  updated_at: string;
}

export interface StaffWithRole extends Staff {
  role?: string | null;
}

export interface StaffInsert {
  user_id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  email: string;
  phone?: string | null;
  gender: string;
  date_of_birth?: string | null;
  avatar_url?: string | null;
  qualification?: string | null;
  employment_date?: string | null;
  employment_status?: string;
  school_id?: string;
}

export function useStaff() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['staff', schoolId],
    queryFn: async (): Promise<StaffWithRole[]> => {
      if (!schoolId) return [];
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('school_id', schoolId)
        .order('last_name', { ascending: true });

      if (staffError) throw staffError;
      if (!staffData || staffData.length === 0) return [];

      const userIds = staffData.map(s => s.user_id).filter((id): id is string => !!id);
      const { data: rolesData } = userIds.length > 0
        ? await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', userIds)
        : { data: [] as { user_id: string; role: string }[] };

      const rolesMap = new Map<string, string>((rolesData || []).map((r): [string, string] => [r.user_id, r.role]));

      return staffData.map(staff => ({
        ...staff,
        role: rolesMap.get(staff.user_id) || null,
      }));
    },
    enabled: !!schoolId,
  });
}

export function useTeachers() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data: teacherRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'teacher');

      if (rolesError) throw rolesError;

      const teacherUserIds = teacherRoles?.map(r => r.user_id) || [];
      if (teacherUserIds.length === 0) return [];

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('school_id', schoolId)
        .in('user_id', teacherUserIds)
        .order('last_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: async (): Promise<Staff | null> => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (staff: StaffInsert) => {
      const payload = staff.school_id ? staff : withSchoolId(staff, schoolId);
      const { data, error } = await supabase
        .from('staff')
        .insert(payload as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...update }: Partial<StaffInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from('staff')
        .update(update)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Same reasoning as useDeleteStudent: routed through delete-user-account
      // instead of a plain table delete, which previously left the staff
      // member's login (auth.users + user_roles) fully working after
      // "deletion" — worse for staff, since staff.user_id had no FK to
      // auth.users at all, so nothing there was ever cleaned up.
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        body: { domain_table: 'staff', domain_id: id },
        headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.warning) console.warn(data.warning);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

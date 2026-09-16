import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolId, withSchoolId } from './useSchoolId';
import { toast } from 'sonner';

export function useSchoolSetting(key: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['school-settings', schoolId, key],
    queryFn: async () => {
      if (!schoolId) return false;
      const { data, error } = await supabase
        .from('school_settings' as any)
        .select('value')
        .eq('school_id', schoolId)
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value ?? false;
    },
    enabled: !!schoolId,
  });
}

export function useUpdateSchoolSetting() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async ({ key, value, updatedBy }: { key: string; value: any; updatedBy: string }) => {
      const payload = withSchoolId(
        { key, value, updated_by: updatedBy, updated_at: new Date().toISOString() },
        schoolId,
      );
      const { error } = await supabase
        .from('school_settings' as any)
        .upsert(payload, { onConflict: 'school_id,key' });
      if (error) throw error;

      // Settings changes are exactly what an audit trail is for — who flipped a
      // restriction switch and when. Logging failures here shouldn't block the
      // actual setting change, so this is best-effort.
      try {
        await supabase.from('audit_log' as any).insert({
          user_id: updatedBy,
          user_name: user?.name || null,
          action: 'update',
          entity_type: 'school_setting',
          entity_id: key,
          details: { key, value },
        });
      } catch {}
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['school-settings', schoolId, vars.key] });
      toast.success('Setting updated');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useProctorMode() {
  return useSchoolSetting('proctor_mode');
}

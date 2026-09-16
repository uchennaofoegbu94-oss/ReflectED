import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useFeatureFlags() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['feature-flags', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return {};
      const { data, error } = await supabase
        .from('school_feature_flags')
        .select('module_name, is_enabled')
        .eq('school_id', user.schoolId);
      if (error) throw error;
      const flags: Record<string, boolean> = {};
      (data || []).forEach((f: any) => {
        flags[f.module_name] = f.is_enabled;
      });
      return flags;
    },
    enabled: !!user?.schoolId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsModuleEnabled(moduleName: string): boolean {
  const { data: flags } = useFeatureFlags();
  // If no flags configured, default to enabled
  if (!flags || Object.keys(flags).length === 0) return true;
  // If this specific module isn't in flags, default to enabled
  if (flags[moduleName] === undefined) return true;
  return flags[moduleName];
}

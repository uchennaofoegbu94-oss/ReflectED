import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformSettings {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  self_service_signup_enabled: boolean;
}

/** Read-only platform_settings lookup — RLS on that table allows SELECT
 * to anyone (including logged-out visitors), specifically so the public
 * Login/Signup page can check it before auth even happens. Writing is
 * super-admin-only (see SuperAdminSettingsPage). */
export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings-public'],
    queryFn: async (): Promise<PlatformSettings> => {
      const { data, error } = await supabase
        .from('platform_settings' as any)
        .select('maintenance_mode, maintenance_message, self_service_signup_enabled')
        .single();
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
  });
}

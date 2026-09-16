import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ParentNotification {
  id: string;
  parent_id: string;
  child_id: string;
  notification_type: string;
  message: string;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useParentNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parent-notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('parent_notifications' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) as any);
      if (error) throw error;
      return (data || []) as ParentNotification[];
    },
    enabled: !!user && user.role === 'parent',
  });
}

export function useMarkParentNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('parent_notifications' as any)
        .update({ is_read: true })
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-notifications', user?.id] });
    },
  });
}

export function useUnreadParentNotificationCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['parent-notifications-count', user?.id],
    queryFn: async () => {
      const { count, error } = await (supabase
        .from('parent_notifications' as any)
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false) as any);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user && user.role === 'parent',
  });
}

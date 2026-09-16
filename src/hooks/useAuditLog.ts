import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

export interface AuditLogFilters {
  limit?: number;
  search?: string;
  entityType?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
}

export function useAuditLog(filters: AuditLogFilters = {}) {
  const { limit = 100, search, entityType, dateFrom, dateTo } = filters;
  return useQuery({
    queryKey: ['audit-log', limit, search, entityType, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('audit_log' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (entityType) query = query.eq('entity_type', entityType);
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);
      if (search) query = query.or(`action.ilike.%${search}%,user_name.ilike.%${search}%,entity_type.ilike.%${search}%`);

      const { data, error } = await (query as any);
      if (error) throw error;
      return (data || []) as AuditLogEntry[];
    },
  });
}

export function useLogAction() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (entry: {
      action: string;
      entity_type: string;
      entity_id?: string;
      details?: any;
    }) => {
      const { error } = await (supabase
        .from('audit_log' as any)
        .insert({
          user_id: user?.id,
          user_name: user?.name,
          ...entry,
        }) as any);
      if (error) throw error;
    },
  });
}

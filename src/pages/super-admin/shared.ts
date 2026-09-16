import { supabase } from '@/integrations/supabase/client';

// Shared by every super-admin page — extracted from the old monolithic
// SuperAdmin.tsx so each routed page can import it without duplicating.
export const invokeManageSchool = async (body: any) => {
  const { data, error } = await supabase.functions.invoke('manage-school', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export const invokeMessage = async (body: any) => {
  const { data, error } = await supabase.functions.invoke('super-admin-message', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolId } from './useSchoolId';
import { toast } from 'sonner';

export interface SchoolAnnouncement {
  id: string;
  title: string;
  content: string;
  announcement_type: 'banner' | 'notice' | 'update' | 'downtime';
  priority: 'normal' | 'high';
  is_active: boolean;
  created_by: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

/** Active, in-window announcements — what the dismissible banner
 * shows. RLS already filters to same_school + active + within the
 * starts_at/ends_at window, so this query just needs is_active. */
export function useSchoolAnnouncements() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['school-announcements', schoolId],
    queryFn: async (): Promise<SchoolAnnouncement[]> => {
      const { data, error } = await supabase
        .from('school_announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SchoolAnnouncement[];
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Everything, including inactive/expired — for the admin/permitted-
 * teacher management view. RLS restricts this to whoever is actually
 * allowed to manage announcements. */
export function useAllSchoolAnnouncements() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['all-school-announcements', schoolId],
    queryFn: async (): Promise<SchoolAnnouncement[]> => {
      const { data, error } = await supabase
        .from('school_announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SchoolAnnouncement[];
    },
    enabled: !!schoolId,
  });
}

/** Whether the current user can post announcements — admin/principal
 * always can; a teacher can only if specifically granted. Drives
 * whether the "New Announcement" UI shows at all. */
export function useCanPostAnnouncements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['can-post-announcements', user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user) return false;
      if (user.role === 'admin' || user.role === 'principal') return true;
      if (user.role !== 'teacher') return false;
      const { data, error } = await supabase
        .from('staff')
        .select('can_post_announcements')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return !!data?.can_post_announcements;
    },
    enabled: !!user,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      title: string; content: string;
      announcement_type: SchoolAnnouncement['announcement_type'];
      priority: SchoolAnnouncement['priority'];
      ends_at?: string | null;
    }) => {
      const { error } = await supabase.from('school_announcements').insert({
        ...data,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['all-school-announcements'] });
      toast.success('Announcement posted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string; title?: string; content?: string;
      announcement_type?: SchoolAnnouncement['announcement_type'];
      priority?: SchoolAnnouncement['priority'];
      is_active?: boolean;
      ends_at?: string | null;
    }) => {
      const { error } = await supabase.from('school_announcements').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['all-school-announcements'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('school_announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['all-school-announcements'] });
      toast.success('Announcement removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Admin/principal-only (RLS-enforced) — grants or revokes a
 * teacher's ability to post announcements. */
export function useTogglePermittedAnnouncer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, canPost }: { staffId: string; canPost: boolean }) => {
      const { error } = await supabase
        .from('staff')
        .update({ can_post_announcements: canPost })
        .eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

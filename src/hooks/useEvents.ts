import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSchoolId } from './useSchoolId';

export interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  type: string;
  coordinator_id: string;
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventWithDetails extends Event {
  coordinator?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  participants_count?: number;
  supporters_count?: number;
}

export interface EventParticipant {
  id: string;
  event_id: string;
  student_id: string;
  joined_at: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
  };
}

export interface EventSupporter {
  id: string;
  event_id: string;
  user_id: string;
  support_type: string | null;
  notes: string | null;
  joined_at: string;
  profile?: {
    full_name: string;
  };
}

export function useEvents() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['events', schoolId],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('event_date', { ascending: true });

      if (error) throw error;

      // Fetch coordinator details and counts for each event
      const eventsWithDetails: EventWithDetails[] = await Promise.all(
        (events || []).map(async (event) => {
          // Get coordinator from staff table
          const { data: coordinator } = await supabase
            .from('staff')
            .select('id, first_name, last_name')
            .eq('id', event.coordinator_id)
            .single();

          // Get participants count
          const { count: participantsCount } = await supabase
            .from('event_participants')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          // Get supporters count
          const { count: supportersCount } = await supabase
            .from('event_supporters')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          return {
            ...event,
            coordinator,
            participants_count: participantsCount || 0,
            supporters_count: supportersCount || 0,
          };
        })
      );

      return eventsWithDetails;
    },
    enabled: !!schoolId,
  });
}

export function useUpcomingEvents(limit = 5) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['events', 'upcoming', schoolId, limit],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data as Event[];
    },
    enabled: !!schoolId,
  });
}

export function useEventParticipants(eventId: string) {
  return useQuery({
    queryKey: ['event-participants', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_participants')
        .select(`
          *,
          student:students(id, first_name, last_name, admission_number)
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      return data as EventParticipant[];
    },
    enabled: !!eventId,
  });
}

export function useEventSupporters(eventId: string) {
  return useQuery({
    queryKey: ['event-supporters', eventId],
    queryFn: async () => {
      // Fetch supporters without join since there's no direct FK
      const { data: supporters, error } = await supabase
        .from('event_supporters')
        .select('*')
        .eq('event_id', eventId);

      if (error) throw error;

      // Fetch profile data for each supporter
      const supportersWithProfiles: EventSupporter[] = await Promise.all(
        (supporters || []).map(async (supporter) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', supporter.user_id)
            .single();

          return {
            ...supporter,
            profile: profile || undefined,
          };
        })
      );

      return supportersWithProfiles;
    },
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventData: {
      title: string;
      description?: string;
      event_date: string;
      event_time?: string;
      location?: string;
      type: string;
      coordinator_id: string;
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create event', { description: error.message });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Event> & { id: string }) => {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update event', { description: error.message });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete event', { description: error.message });
    },
  });
}

export function useTransferCoordinator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      newCoordinatorId,
    }: {
      eventId: string;
      newCoordinatorId: string;
    }) => {
      const { error } = await supabase
        .from('events')
        .update({ coordinator_id: newCoordinatorId })
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Coordinator transferred successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to transfer coordinator', { description: error.message });
    },
  });
}

export function useJoinEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      studentId,
    }: {
      eventId: string;
      studentId: string;
    }) => {
      const { error } = await supabase
        .from('event_participants')
        .insert([{ event_id: eventId, student_id: studentId }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-participants'] });
      toast.success('Successfully joined event');
    },
    onError: (error: Error) => {
      toast.error('Failed to join event', { description: error.message });
    },
  });
}

export function useLeaveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      studentId,
    }: {
      eventId: string;
      studentId: string;
    }) => {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('student_id', studentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-participants'] });
      toast.success('Successfully left event');
    },
    onError: (error: Error) => {
      toast.error('Failed to leave event', { description: error.message });
    },
  });
}

export function useSupportEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
      supportType,
      notes,
    }: {
      eventId: string;
      userId: string;
      supportType?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('event_supporters')
        .insert([{
          event_id: eventId,
          user_id: userId,
          support_type: supportType,
          notes,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-supporters'] });
      toast.success('Thank you for your support!');
    },
    onError: (error: Error) => {
      toast.error('Failed to support event', { description: error.message });
    },
  });
}

export function useRemoveSupport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      userId,
    }: {
      eventId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from('event_supporters')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-supporters'] });
      toast.success('Support removed');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove support', { description: error.message });
    },
  });
}

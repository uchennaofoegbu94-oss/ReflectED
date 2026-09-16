import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface Message {
  id: string;
  sender_id: string;
  subject: string;
  content: string;
  priority: string;
  is_broadcast: boolean;
  target_roles: string[] | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageWithSender extends Message {
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface MessageRecipient {
  id: string;
  message_id: string;
  recipient_id: string;
  is_read: boolean;
  read_at: string | null;
  is_archived: boolean;
  created_at: string;
}

export function useSentMessages(userId: string) {
  return useQuery({
    queryKey: ['messages', 'sent', userId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Message[];
    },
    enabled: !!userId,
  });
}

export function useMessages() {
  return useQuery({
    queryKey: ['messages', 'all'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { sentMessages: [], receivedMessages: [] };

      const [sentResult, receivedResult] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('message_recipients')
          .select(`
            *,
            messages (
              id,
              sender_id,
              subject,
              content,
              priority,
              is_broadcast,
              created_at
            )
          `)
          .eq('recipient_id', user.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: false }),
      ]);

      if (sentResult.error) throw sentResult.error;
      if (receivedResult.error) throw receivedResult.error;

      return {
        sentMessages: (sentResult.data || []) as Message[],
        receivedMessages: receivedResult.data || [],
      };
    },
  });
}

export function useReceivedMessages(userId: string) {
  return useQuery({
    queryKey: ['messages', 'received', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_recipients')
        .select(`
          *,
          messages (
            id,
            sender_id,
            subject,
            content,
            priority,
            is_broadcast,
            created_at
          )
        `)
        .eq('recipient_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sender_id,
      subject,
      content,
      priority = 'normal',
      is_broadcast = false,
      target_roles,
      recipient_ids,
    }: {
      sender_id: string;
      subject: string;
      content: string;
      priority?: string;
      is_broadcast?: boolean;
      target_roles?: string[];
      recipient_ids?: string[];
    }) => {
      // Create the message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          sender_id,
          subject,
          content,
          priority,
          is_broadcast,
          target_roles: target_roles || null,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // If it's a broadcast to roles, get all users with those roles
      let finalRecipientIds = recipient_ids || [];
      
      if (is_broadcast && target_roles && target_roles.length > 0) {
        const { data: roleUsers, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', target_roles as AppRole[]);

        if (rolesError) throw rolesError;
        finalRecipientIds = roleUsers?.map(r => r.user_id) || [];
      }

      // Create recipients
      if (finalRecipientIds.length > 0) {
        const recipients = finalRecipientIds.map(rid => ({
          message_id: message.id,
          recipient_id: rid,
        }));

        const { error: recipientsError } = await supabase
          .from('message_recipients')
          .insert(recipients);

        if (recipientsError) throw recipientsError;
      }

      return message;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipientId: string) => {
      const { error } = await supabase
        .from('message_recipients')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', recipientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useArchiveMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recipientId: string) => {
      const { error } = await supabase
        .from('message_recipients')
        .update({ is_archived: true })
        .eq('id', recipientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

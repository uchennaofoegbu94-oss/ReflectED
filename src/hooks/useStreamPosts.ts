import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type StreamPost = Database['public']['Tables']['stream_posts']['Row'];
type StreamPostInsert = Database['public']['Tables']['stream_posts']['Insert'];

export interface StreamPostWithDetails extends StreamPost {
  attachments: {
    id: string;
    name: string;
    type: Database['public']['Enums']['attachment_type'];
    url: string;
  }[];
  post_comments: {
    id: string;
    content: string;
    created_at: string;
    author_id: string;
  }[];
}

export function useStreamPosts(classroomId: string) {
  return useQuery({
    queryKey: ['stream_posts', classroomId],
    queryFn: async (): Promise<StreamPostWithDetails[]> => {
      const { data, error } = await supabase
        .from('stream_posts')
        .select(`
          *,
          attachments (
            id,
            name,
            type,
            url
          ),
          post_comments (
            id,
            content,
            created_at,
            author_id
          )
        `)
        .eq('classroom_id', classroomId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as StreamPostWithDetails[];
    },
    enabled: !!classroomId,
  });
}

export function useCreateStreamPost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (post: StreamPostInsert) => {
      const { data, error } = await supabase
        .from('stream_posts')
        .insert(post)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stream_posts', variables.classroom_id] });
    },
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ post_id, content, author_id }: { 
      post_id: string; 
      content: string; 
      author_id: string;
      classroom_id: string;
    }) => {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({ post_id, content, author_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stream_posts', variables.classroom_id] });
    },
  });
}

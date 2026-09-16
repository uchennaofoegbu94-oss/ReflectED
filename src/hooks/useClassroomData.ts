import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ClassroomMaterial {
  id: string;
  name: string;
  url: string;
  type: 'file' | 'link' | 'video' | 'image';
  size?: number;
  createdAt: string;
}

export function useClassroomData(classroomId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch classroom details
  const { data: classroom, isLoading: classroomLoading } = useQuery({
    queryKey: ['classroom', classroomId],
    queryFn: async () => {
      if (!classroomId) return null;
      const { data, error } = await supabase
        .from('classrooms')
        .select(`
          *,
          subjects (name, code),
          class_arms (name, level)
        `)
        .eq('id', classroomId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  // Fetch stream posts
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['stream-posts', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('stream_posts')
        .select(`
          *,
          attachments (*),
          post_comments (*)
        `)
        .eq('classroom_id', classroomId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (postsError) throw postsError;

      // Fetch profiles for authors
      const authorIds = new Set<string>();
      for (const post of postsData || []) {
        authorIds.add(post.author_id);
        for (const comment of post.post_comments || []) {
          authorIds.add(comment.author_id);
        }
      }

      let profilesMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (authorIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', Array.from(authorIds));
        for (const p of profiles || []) {
          profilesMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        }
      }

      // Attach profiles to posts and comments
      return (postsData || []).map(post => ({
        ...post,
        profiles: profilesMap[post.author_id] || null,
        post_comments: (post.post_comments || []).map((c: any) => ({
          ...c,
          profiles: profilesMap[c.author_id] || null,
        })),
      }));
    },
    enabled: !!classroomId,
  });

  // Fetch assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['classroom-assignments', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          attachments (*),
          submissions (*)
        `)
        .eq('classroom_id', classroomId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  // Fetch classroom members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['classroom-members', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data, error } = await supabase
        .from('classroom_members')
        .select(`
          *,
          students (
            id,
            first_name,
            last_name,
            avatar_url,
            admission_number
          )
        `)
        .eq('classroom_id', classroomId);
      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
  });

  // Create stream post
  const createPost = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: { name: string; url: string; type: 'file' | 'link' | 'video' | 'image' }[] }) => {
      if (!classroomId || !user) throw new Error('Missing classroom or user');
      
      const { data: post, error: postError } = await supabase
        .from('stream_posts')
        .insert({
          classroom_id: classroomId,
          author_id: user.id,
          content,
        })
        .select()
        .single();
      
      if (postError) throw postError;

      // Add attachments if any
      if (attachments && attachments.length > 0) {
        const { error: attachError } = await supabase
          .from('attachments')
          .insert(attachments.map(att => ({
            post_id: post.id,
            name: att.name,
            url: att.url,
            type: att.type,
          })));
        if (attachError) throw attachError;
      }

      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stream-posts', classroomId] });
      toast.success('Post created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create post: ' + error.message);
    },
  });

  // Create comment
  const createComment = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stream-posts', classroomId] });
    },
    onError: (error) => {
      toast.error('Failed to add comment: ' + error.message);
    },
  });

  // Create assignment
  const createAssignment = useMutation({
    mutationFn: async (assignment: {
      title: string;
      instructions?: string;
      topic?: string;
      dueDate?: string;
      dueTime?: string;
      points?: number;
      status?: 'draft' | 'published' | 'scheduled';
      allowLateSubmission?: boolean;
      attachments?: { name: string; url: string; type: 'file' | 'link' | 'video' | 'image' }[];
    }) => {
      if (!classroomId || !user) throw new Error('Missing classroom or user');
      
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          classroom_id: classroomId,
          created_by: user.id,
          title: assignment.title,
          instructions: assignment.instructions,
          topic: assignment.topic,
          due_date: assignment.dueDate,
          due_time: assignment.dueTime,
          points: assignment.points || 100,
          status: assignment.status || 'published',
          allow_late_submission: assignment.allowLateSubmission ?? true,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Add attachments if any
      if (assignment.attachments && assignment.attachments.length > 0) {
        const { error: attachError } = await supabase
          .from('attachments')
          .insert(assignment.attachments.map(att => ({
            assignment_id: data.id,
            name: att.name,
            url: att.url,
            type: att.type,
          })));
        if (attachError) throw attachError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-assignments', classroomId] });
      toast.success('Assignment created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create assignment: ' + error.message);
    },
  });

  // Upload file to storage and get public URL
  const uploadFile = async (file: File, folder: string = 'materials') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${classroomId}/${folder}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('classroom-materials')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: urlData } = supabase.storage
      .from('classroom-materials')
      .getPublicUrl(data.path);
    
    return {
      name: file.name,
      url: urlData.publicUrl,
      type: getFileType(file.type),
      size: file.size,
    };
  };

  return {
    classroom,
    posts,
    assignments,
    members,
    isLoading: classroomLoading || postsLoading || assignmentsLoading || membersLoading,
    createPost,
    createComment,
    createAssignment,
    uploadFile,
  };
}

function getFileType(mimeType: string): 'file' | 'link' | 'video' | 'image' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}

// Hook for fetching user's classrooms
export function useMyClassrooms() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-classrooms', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // For teachers/staff - get classrooms they teach
      if (user.role === 'teacher' || user.role === 'admin' || user.role === 'principal') {
        // First get the staff ID for the current user
        const { data: staffData, error: staffError } = await supabase
          .from('staff')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (staffError) throw staffError;
        if (!staffData) return []; // No staff record means no classrooms
        
        const { data, error } = await supabase
          .from('classrooms')
          .select(`
            *,
            subjects (name, code),
            class_arms (name, level)
          `)
          .eq('teacher_id', staffData.id)
          .eq('is_archived', false);
        if (error) throw error;
        return data || [];
      }
      
      // For students - get enrolled classrooms
      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!studentData) return [];
      
      const { data, error } = await supabase
        .from('classroom_members')
        .select(`
          classrooms (
            *,
            subjects (name, code),
            class_arms (name, level)
          )
        `)
        .eq('student_id', studentData.id);
      
      if (error) throw error;
      return data?.map(d => d.classrooms).filter(Boolean) || [];
    },
    enabled: !!user,
  });
}

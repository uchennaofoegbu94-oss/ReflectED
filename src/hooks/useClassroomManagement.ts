import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Classroom CRUD operations
export function useCreateClassroom() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (classroom: {
      name: string;
      description?: string;
      subject_id?: string;
      class_id?: string;
      banner_color?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      // Get the staff ID and school_id for this user
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, school_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (staffError) throw staffError;
      if (!staffData) throw new Error('Staff record not found. Only teachers can create classrooms.');

      const schoolId = staffData.school_id || user.schoolId;
      if (!schoolId) throw new Error('No school associated with your account.');
      
      // Generate unique code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { data, error } = await supabase
        .from('classrooms')
        .insert({
          ...classroom,
          code,
          teacher_id: staffData.id,
          school_id: schoolId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      toast.success('Classroom created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create classroom: ' + error.message);
    },
  });
}

export function useUpdateClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      description?: string;
      subject_id?: string;
      class_id?: string;
      banner_color?: string;
      banner_image_url?: string | null;
      is_archived?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('classrooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classroom', variables.id] });
      toast.success('Classroom updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update classroom: ' + error.message);
    },
  });
}

export function useDeleteClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by archiving
      const { error } = await supabase
        .from('classrooms')
        .update({ is_archived: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      toast.success('Classroom deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete classroom: ' + error.message);
    },
  });
}

// Transfer classroom ownership
// NOTE: newTeacherId should be the staff.id (not user_id)
export function useTransferClassroom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classroomId, newTeacherId }: { classroomId: string; newTeacherId: string }) => {
      const { data, error } = await supabase
        .from('classrooms')
        .update({ teacher_id: newTeacherId })
        .eq('id', classroomId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-classrooms'] });
      queryClient.invalidateQueries({ queryKey: ['classroom', variables.classroomId] });
      toast.success('Classroom ownership transferred successfully');
    },
    onError: (error) => {
      toast.error('Failed to transfer classroom: ' + error.message);
    },
  });
}

// Co-teacher management
export function useCoTeachers(classroomId?: string) {
  return useQuery({
    queryKey: ['co-teachers', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data, error } = await supabase
        .from('classroom_co_teachers')
        .select(`
          *,
          staff:teacher_id (
            id,
            user_id,
            first_name,
            last_name,
            avatar_url,
            email
          )
        `)
        .eq('classroom_id', classroomId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
  });
}

// NOTE: teacherId should be the staff.id (not user_id)
export function useAddCoTeacher() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ classroomId, teacherId }: { classroomId: string; teacherId: string }) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('classroom_co_teachers')
        .insert({
          classroom_id: classroomId,
          teacher_id: teacherId, // This is staff.id
          added_by: user.id, // This is auth.uid()
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['co-teachers', variables.classroomId] });
      toast.success('Co-teacher added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add co-teacher: ' + error.message);
    },
  });
}

// NOTE: teacherId should be the staff.id (not user_id)
export function useRemoveCoTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ classroomId, teacherId }: { classroomId: string; teacherId: string }) => {
      const { error } = await supabase
        .from('classroom_co_teachers')
        .delete()
        .eq('classroom_id', classroomId)
        .eq('teacher_id', teacherId); // This is staff.id
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['co-teachers', variables.classroomId] });
      toast.success('Co-teacher removed');
    },
    onError: (error) => {
      toast.error('Failed to remove co-teacher: ' + error.message);
    },
  });
}

// Syllabus management
export function useSyllabus(classroomId?: string) {
  return useQuery({
    queryKey: ['syllabus', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data, error } = await supabase
        .from('classroom_syllabus')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('week_number', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
  });
}

export function useCreateSyllabusItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: {
      classroom_id: string;
      title: string;
      content?: string;
      week_number?: number;
      topic?: string;
      objectives?: string;
      activities?: string;
      resources?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('classroom_syllabus')
        .insert({
          ...item,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['syllabus', variables.classroom_id] });
      toast.success('Syllabus item added');
    },
    onError: (error) => {
      toast.error('Failed to add syllabus item: ' + error.message);
    },
  });
}

export function useUpdateSyllabusItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classroomId, ...updates }: {
      id: string;
      classroomId: string;
      title?: string;
      content?: string;
      week_number?: number;
      topic?: string;
      objectives?: string;
      activities?: string;
      resources?: string;
    }) => {
      const { data, error } = await supabase
        .from('classroom_syllabus')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['syllabus', variables.classroomId] });
      toast.success('Syllabus updated');
    },
    onError: (error) => {
      toast.error('Failed to update syllabus: ' + error.message);
    },
  });
}

export function useDeleteSyllabusItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classroomId }: { id: string; classroomId: string }) => {
      const { error } = await supabase
        .from('classroom_syllabus')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['syllabus', variables.classroomId] });
      toast.success('Syllabus item deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete syllabus item: ' + error.message);
    },
  });
}

// Live class sessions
export function useLiveClasses(classroomId?: string) {
  return useQuery({
    queryKey: ['live-classes', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data, error } = await supabase
        .from('live_class_sessions')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!classroomId,
  });
}

export function useCreateLiveClass() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (session: {
      classroom_id: string;
      title: string;
      description?: string;
      scheduled_at: string;
      duration_minutes?: number;
      meeting_link?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('live_class_sessions')
        .insert({
          ...session,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['live-classes', variables.classroom_id] });
      toast.success('Live class scheduled');
    },
    onError: (error) => {
      toast.error('Failed to schedule live class: ' + error.message);
    },
  });
}

export function useUpdateLiveClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classroomId, ...updates }: {
      id: string;
      classroomId: string;
      title?: string;
      description?: string;
      scheduled_at?: string;
      duration_minutes?: number;
      meeting_link?: string;
      status?: 'scheduled' | 'live' | 'ended' | 'cancelled';
    }) => {
      const { data, error } = await supabase
        .from('live_class_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['live-classes', variables.classroomId] });
      toast.success('Live class updated');
    },
    onError: (error) => {
      toast.error('Failed to update live class: ' + error.message);
    },
  });
}

export function useDeleteLiveClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, classroomId }: { id: string; classroomId: string }) => {
      const { error } = await supabase
        .from('live_class_sessions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['live-classes', variables.classroomId] });
      toast.success('Live class cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel live class: ' + error.message);
    },
  });
}

// Create notification for students when materials are uploaded
export async function notifyClassroomMembers(
  classroomId: string, 
  title: string, 
  message: string,
  link?: string
) {
  try {
    // Get all students in the classroom
    const { data: members, error: membersError } = await supabase
      .from('classroom_members')
      .select('students(user_id)')
      .eq('classroom_id', classroomId);
    
    if (membersError) throw membersError;
    
    // Create notifications for each student
    const notifications = members
      ?.map((m: any) => m.students?.user_id)
      .filter(Boolean)
      .map((userId: string) => ({
        user_id: userId,
        title,
        message,
        type: 'info' as const,
        link,
      }));
    
    if (notifications && notifications.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (error) throw error;
    }
  } catch (error) {
    console.error('Failed to notify students:', error);
  }
}

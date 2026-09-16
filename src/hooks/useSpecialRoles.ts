import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SpecialRoleType = 
  | 'form_teacher' | 'games_master' | 'dean_of_studies' | 'head_of_department'
  | 'exam_officer' | 'guidance_counselor' | 'librarian' | 'ict_coordinator'
  | 'vice_principal' | 'duty_marshall' | 'music_social_coordinator'
  | 'head_prefect' | 'assistant_head_prefect' | 'class_prefect' | 'sports_prefect'
  | 'library_prefect' | 'health_prefect' | 'social_prefect' | 'labour_prefect'
  | 'utilities_prefect' | 'regulator' | 'assistant_regulator' | 'senior_prefect'
  | 'deputy_senior_prefect' | 'teacher_assistant' | 'drum_major' | 'laboratories_prefect';

export const STAFF_ROLES: SpecialRoleType[] = [
  'form_teacher', 'games_master', 'dean_of_studies', 'head_of_department',
  'exam_officer', 'guidance_counselor', 'librarian', 'ict_coordinator',
  'vice_principal', 'duty_marshall', 'music_social_coordinator',
];

export const STUDENT_ROLES: SpecialRoleType[] = [
  'head_prefect', 'assistant_head_prefect', 'class_prefect', 'sports_prefect',
  'library_prefect', 'health_prefect', 'social_prefect', 'labour_prefect',
  'utilities_prefect', 'regulator', 'assistant_regulator', 'senior_prefect',
  'deputy_senior_prefect', 'teacher_assistant', 'drum_major', 'laboratories_prefect',
];

export const ROLE_LABELS: Record<SpecialRoleType, string> = {
  form_teacher: 'Form Teacher',
  games_master: 'Games Master',
  dean_of_studies: 'Dean of Studies',
  head_of_department: 'Head of Department',
  exam_officer: 'Exam Officer',
  guidance_counselor: 'Guidance Counselor',
  librarian: 'Librarian',
  ict_coordinator: 'ICT Coordinator',
  vice_principal: 'Vice-Principal',
  duty_marshall: 'Duty Marshall',
  music_social_coordinator: 'Music/Social Events Coordinator',
  head_prefect: 'Head Prefect',
  assistant_head_prefect: 'Asst. Head Prefect',
  class_prefect: 'Class Prefect',
  sports_prefect: 'Sports Prefect',
  library_prefect: 'Library Prefect',
  health_prefect: 'Health Prefect',
  social_prefect: 'Social Prefect',
  labour_prefect: 'Labour Prefect',
  utilities_prefect: 'Utilities/Special Rooms Prefect',
  regulator: 'Regulator',
  assistant_regulator: 'Asst. Regulator',
  senior_prefect: 'Senior Prefect',
  deputy_senior_prefect: 'Deputy Senior Prefect',
  teacher_assistant: 'Teacher Assistant',
  drum_major: 'Drum Major',
  laboratories_prefect: 'Laboratories Prefect',
};

export interface SpecialRole {
  id: string;
  role_type: SpecialRoleType;
  staff_id: string | null;
  student_id: string | null;
  class_id: string | null;
  session_id: string | null;
  assigned_by: string;
  assigned_at: string;
  is_active: boolean;
  notes: string | null;
  custom_role_name: string | null;
}

export interface SpecialRoleWithDetails extends SpecialRole {
  staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  class_arms?: {
    id: string;
    name: string;
    arm: string;
  } | null;
}

export function useSpecialRoles() {
  return useQuery({
    queryKey: ['special-roles'],
    queryFn: async (): Promise<SpecialRoleWithDetails[]> => {
      const { data, error } = await supabase
        .from('special_roles')
        .select(`
          *,
          staff (id, first_name, last_name),
          students (id, first_name, last_name),
          class_arms (id, name, arm)
        `)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SpecialRoleWithDetails[];
    },
  });
}

export function useCreateSpecialRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (role: {
      role_type: SpecialRoleType;
      staff_id?: string | null;
      student_id?: string | null;
      class_id?: string | null;
      session_id?: string | null;
      assigned_by: string;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('special_roles')
        .insert(role)
        .select()
        .single();

      if (error) throw error;

      // Role assignments (who's Dean of Studies, who's a form teacher badge
      // holder, etc.) are exactly the kind of administrative change worth a
      // trail — best-effort, shouldn't block the assignment itself.
      try {
        await supabase.from('audit_log' as any).insert({
          user_id: role.assigned_by,
          user_name: user?.name || null,
          action: 'assign',
          entity_type: 'special_role',
          entity_id: data?.id,
          details: { role_type: role.role_type, staff_id: role.staff_id, student_id: role.student_id },
        });
      } catch {}

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-roles'] });
    },
  });
}

export function useDeleteSpecialRole() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('special_roles')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      try {
        await supabase.from('audit_log' as any).insert({
          user_id: user?.id,
          user_name: user?.name || null,
          action: 'remove',
          entity_type: 'special_role',
          entity_id: id,
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['special-roles'] });
    },
  });
}

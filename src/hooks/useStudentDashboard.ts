import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StudentAssignment {
  id: string;
  title: string;
  classroomId: string;
  classroomName: string;
  dueDate: string | null;
  points: number | null;
}

interface StudentStats {
  classroomCount: number;
  pendingAssignments: number;
  submittedCount: number;
  gradedCount: number;
}

export function useStudentPendingAssignments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-pending-assignments', user?.id],
    queryFn: async (): Promise<StudentAssignment[]> => {
      if (!user) return [];

      // Get the student record
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!student) return [];

      // Get classrooms the student is enrolled in
      const { data: memberships } = await supabase
        .from('classroom_members')
        .select('classroom_id')
        .eq('student_id', student.id);

      if (!memberships || memberships.length === 0) return [];

      const classroomIds = memberships.map(m => m.classroom_id);

      // Get assignments from those classrooms
      const { data: assignments, error } = await supabase
        .from('assignments')
        .select(`
          id,
          title,
          due_date,
          points,
          classroom_id,
          classrooms (name)
        `)
        .in('classroom_id', classroomIds)
        .eq('status', 'published')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Get student's submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', student.id);

      const submittedIds = new Set(submissions?.map(s => s.assignment_id) || []);

      // Filter out already submitted assignments
      const pendingAssignments = (assignments || [])
        .filter(a => !submittedIds.has(a.id))
        .map(a => ({
          id: a.id,
          title: a.title,
          classroomId: a.classroom_id,
          classroomName: (a.classrooms as any)?.name || 'Unknown Classroom',
          dueDate: a.due_date,
          points: a.points,
        }));

      return pendingAssignments;
    },
    enabled: !!user && user.role === 'student',
  });
}

export function useStudentStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-stats', user?.id],
    queryFn: async (): Promise<StudentStats> => {
      if (!user) {
        return { classroomCount: 0, pendingAssignments: 0, submittedCount: 0, gradedCount: 0 };
      }

      // Get the student record
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!student) {
        return { classroomCount: 0, pendingAssignments: 0, submittedCount: 0, gradedCount: 0 };
      }

      // Get classroom count
      const { count: classroomCount } = await supabase
        .from('classroom_members')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', student.id);

      // Get classrooms the student is enrolled in
      const { data: memberships } = await supabase
        .from('classroom_members')
        .select('classroom_id')
        .eq('student_id', student.id);

      const classroomIds = memberships?.map(m => m.classroom_id) || [];

      // Get all published assignments from those classrooms
      const { data: allAssignments } = await supabase
        .from('assignments')
        .select('id')
        .in('classroom_id', classroomIds.length > 0 ? classroomIds : ['none'])
        .eq('status', 'published');

      const assignmentIds = allAssignments?.map(a => a.id) || [];

      // Get student's submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, assignment_id, status')
        .eq('student_id', student.id);

      const submittedAssignmentIds = new Set(submissions?.map(s => s.assignment_id) || []);

      // Calculate pending (not submitted)
      const pendingAssignments = assignmentIds.filter(id => !submittedAssignmentIds.has(id)).length;

      // Calculate submitted and graded
      const submittedCount = submissions?.filter(s => s.status === 'submitted').length || 0;
      const gradedCount = submissions?.filter(s => s.status === 'graded' || s.status === 'returned').length || 0;

      return {
        classroomCount: classroomCount || 0,
        pendingAssignments,
        submittedCount,
        gradedCount,
      };
    },
    enabled: !!user && user.role === 'student',
  });
}

interface StudentQuiz {
  id: string;
  title: string;
  classroomId: string;
  classroomName: string;
  scheduledAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
}

/** Mirrors useStudentPendingAssignments — quizzes newly posted by a teacher
 * previously only showed up on the Quizzes page itself, not the dashboard,
 * unlike assignments which already had this. */
export function useStudentPendingQuizzes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['student-pending-quizzes', user?.id],
    queryFn: async (): Promise<StudentQuiz[]> => {
      if (!user) return [];

      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!student) return [];

      const { data: memberships } = await supabase
        .from('classroom_members')
        .select('classroom_id')
        .eq('student_id', student.id);

      if (!memberships || memberships.length === 0) return [];

      const classroomIds = memberships.map(m => m.classroom_id);

      // RLS already excludes locked/archived/inactive quizzes and classrooms
      // the student isn't a member of — this filter is just the additional
      // "not yet attempted" narrowing for the dashboard's pending list.
      const { data: quizzes, error } = await supabase
        .from('quizzes')
        .select(`
          id, title, scheduled_at, ends_at, duration_minutes, classroom_id,
          classrooms (name)
        `)
        .in('classroom_id', classroomIds)
        .order('scheduled_at', { ascending: true, nullsFirst: false });

      if (error) throw error;
      if (!quizzes || quizzes.length === 0) return [];

      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('quiz_id')
        .eq('student_id', student.id);

      const attemptedIds = new Set(attempts?.map(a => a.quiz_id) || []);

      return quizzes
        .filter(q => !attemptedIds.has(q.id))
        .map(q => ({
          id: q.id,
          title: q.title,
          classroomId: q.classroom_id,
          classroomName: (q.classrooms as any)?.name || 'Unknown Classroom',
          scheduledAt: q.scheduled_at,
          endsAt: q.ends_at,
          durationMinutes: q.duration_minutes,
        }));
    },
    enabled: !!user && user.role === 'student',
  });
}

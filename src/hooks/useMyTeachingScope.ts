import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolId } from './useSchoolId';

/**
 * Scopes the current teacher's class/subject access for Attendance and
 * Pre-CA/Broadsheet. Mirrors the RLS logic in the teacher_scoping migration:
 *  - Form teacher (class_arms.class_teacher_id) of a class: full access to that
 *    class, all its subjects.
 *  - Subject-assigned teacher (class_subjects.teacher_id, or classroom
 *    ownership/co-teaching): access to that class, that subject only.
 *
 * Admins/principals should bypass this hook entirely and use the unfiltered
 * useClassArms()/useSubjects() lists — this hook is teacher-only scoping.
 */
export interface TeachingScope {
  /** Class IDs this teacher has any access to (form teacher or subject teacher). */
  accessibleClassIds: Set<string>;
  /** Class IDs this teacher is the form teacher of. */
  formTeacherClassIds: Set<string>;
  /** Subject IDs this teacher is assigned to teach, per class. */
  subjectsByClass: Map<string, Set<string>>;
  isFormTeacherOf: (classId: string) => boolean;
  /** Subjects this teacher may act on for a given class — all class subjects if
   * form teacher of that class, otherwise only their assigned subjects. */
  allowedSubjectIdsForClass: (classId: string, allClassSubjectIds: string[]) => string[];
}

export function useMyTeachingScope() {
  const { user } = useAuth();
  const schoolId = useSchoolId();
  const isTeacher = user?.role === 'teacher';

  const query = useQuery({
    queryKey: ['my-teaching-scope', schoolId, user?.id],
    queryFn: async (): Promise<TeachingScope> => {
      const { data: staffRow, error: staffErr } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (staffErr) throw staffErr;

      const staffId = staffRow?.id;
      if (!staffId) {
        return emptyScope();
      }

      const [formClassesRes, subjectAssignmentsRes, classroomAssignmentsRes] = await Promise.all([
        supabase.from('class_arms').select('id').eq('class_teacher_id', staffId),
        supabase.from('class_subjects').select('class_id, subject_id').eq('teacher_id', staffId),
        supabase
          .from('classrooms')
          .select('class_id, subject_id, id')
          .eq('teacher_id', staffId),
      ]);
      if (formClassesRes.error) throw formClassesRes.error;
      if (subjectAssignmentsRes.error) throw subjectAssignmentsRes.error;
      if (classroomAssignmentsRes.error) throw classroomAssignmentsRes.error;

      // Co-taught classrooms need a second query keyed off classroom_co_teachers.
      const { data: coTeaching, error: coTeachErr } = await supabase
        .from('classroom_co_teachers')
        .select('classrooms(class_id, subject_id)')
        .eq('teacher_id', staffId);
      if (coTeachErr) throw coTeachErr;

      const formTeacherClassIds = new Set<string>(
        (formClassesRes.data || []).map((c) => c.id)
      );
      const subjectsByClass = new Map<string, Set<string>>();
      const addAssignment = (classId: string | null, subjectId: string | null) => {
        if (!classId || !subjectId) return;
        if (!subjectsByClass.has(classId)) subjectsByClass.set(classId, new Set());
        subjectsByClass.get(classId)!.add(subjectId);
      };

      (subjectAssignmentsRes.data || []).forEach((row) => addAssignment(row.class_id, row.subject_id));
      (classroomAssignmentsRes.data || []).forEach((row) => addAssignment(row.class_id, row.subject_id));
      (coTeaching || []).forEach((row: any) => {
        const cr = row.classrooms;
        if (cr) addAssignment(cr.class_id, cr.subject_id);
      });

      const accessibleClassIds = new Set<string>([
        ...formTeacherClassIds,
        ...subjectsByClass.keys(),
      ]);

      return {
        accessibleClassIds,
        formTeacherClassIds,
        subjectsByClass,
        isFormTeacherOf: (classId: string) => formTeacherClassIds.has(classId),
        allowedSubjectIdsForClass: (classId: string, allClassSubjectIds: string[]) => {
          if (formTeacherClassIds.has(classId)) return allClassSubjectIds;
          const mine = subjectsByClass.get(classId);
          if (!mine) return [];
          return allClassSubjectIds.filter((id) => mine.has(id));
        },
      };
    },
    enabled: !!user?.id && !!schoolId && isTeacher,
  });

  return {
    ...query,
    data: query.data ?? emptyScope(),
    isTeacher,
  };
}

function emptyScope(): TeachingScope {
  return {
    accessibleClassIds: new Set(),
    formTeacherClassIds: new Set(),
    subjectsByClass: new Map(),
    isFormTeacherOf: () => false,
    allowedSubjectIdsForClass: () => [],
  };
}

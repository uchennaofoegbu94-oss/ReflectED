import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolId } from './useSchoolId';
import { toast } from 'sonner';

type ResultTranscript = Database['public']['Tables']['result_transcripts']['Row'];

export interface BroadsheetEntry {
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string;
  subjects: {
    subject_id: string;
    subject_name: string;
    ca1: number | null;
    ca2: number | null;
    ca3: number | null;
    total_ca: number | null;
    exam: number | null;
    total: number | null;
    grade: string | null;
  }[];
  total_ca_score: number;
  total_score: number;
  average_score: number;
  final_grade: string | null;
  position?: number;
}

export interface StudentReportCard {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_name: string;
    avatar_url: string | null;
  };
  term: {
    id: string;
    name: string;
  };
  session: {
    id: string;
    name: string;
  };
  subjects: {
    subject_id: string;
    subject_name: string;
    ca1: number | null;
    ca2: number | null;
    ca3: number | null;
    exam: number | null;
    total: number | null;
    grade: string | null;
    remarks: string | null;
  }[];
  summary: {
    total_score: number;
    average_score: number;
    position: number;
    class_size: number;
  };
  attendance: {
    times_present: number;
    times_absent: number;
    times_late: number;
    times_excused: number;
    school_days_opened: number;
    /** false when the term has no start_date/end_date set — the zeros
     * above are meaningless in that case, not "no absences". */
    dates_configured: boolean;
  };
  behavioral_ratings: {
    affective: Array<{ trait_name: string; rating: number }>;
    psychomotor: Array<{ trait_name: string; rating: number }>;
  };
  grade_analysis: Array<{ grade: string; remark: string; count: number }>;
  grading_legend: Array<{ grade: string; min_score: number; max_score: number; remark: string }>;
  remarks: {
    class_teacher: string | null;
    principal: string | null;
  };
}

// Fetch broadsheet data for a class/term
export function useBroadsheet(classId?: string, termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['broadsheet', classId, termId, schoolId],
    queryFn: async (): Promise<BroadsheetEntry[]> => {
      if (!classId || !termId) return [];

      // Get all students in the class
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number')
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');

      if (studentsError) throw studentsError;
      if (!students?.length) return [];

      // Get class name
      const { data: classData } = await supabase
        .from('class_arms')
        .select('name')
        .eq('id', classId)
        .single();

      // Get all assessment scores for these students in this term
      const studentIds = students.map(s => s.id);
      const { data: scores, error: scoresError } = await supabase
        .from('assessment_scores')
        .select(`
          *,
          subjects (id, name)
        `)
        .in('student_id', studentIds)
        .eq('term_id', termId);

      if (scoresError) throw scoresError;

      // Grading scale for the "final grade" (based on overall average,
      // separate from each subject's own grade) — fetched once rather
      // than per student.
      const { data: gradingScales } = schoolId
        ? await supabase
            .from('grading_scales')
            .select('grade, min_score, max_score')
            .eq('school_id', schoolId)
        : { data: [] as any[] };

      const gradeForAverage = (avg: number): string | null => {
        const match = (gradingScales || []).find(
          (g: any) => avg >= Number(g.min_score) && avg <= Number(g.max_score)
        );
        return match?.grade || null;
      };

      // Build broadsheet entries
      const entries: BroadsheetEntry[] = students.map(student => {
        const studentScores = scores?.filter(s => s.student_id === student.id) || [];
        const subjects = studentScores.map(score => {
          const ca1 = score.ca1 ? Number(score.ca1) : null;
          const ca2 = score.ca2 ? Number(score.ca2) : null;
          const ca3 = score.ca3 ? Number(score.ca3) : null;
          const hasAnyCA = ca1 !== null || ca2 !== null || ca3 !== null;
          return {
            subject_id: score.subject_id,
            subject_name: (score as any).subjects?.name || 'Unknown',
            ca1, ca2, ca3,
            // Total CA is the sum of whatever CA components have been
            // committed via Pre-CA — null (not 0) if none have, so it
            // reads as "not yet scored" rather than a real zero.
            total_ca: hasAnyCA ? (ca1 || 0) + (ca2 || 0) + (ca3 || 0) : null,
            exam: score.exam ? Number(score.exam) : null,
            total: score.total ? Number(score.total) : null,
            grade: score.grade,
          };
        });

        const totalCaScore = subjects.reduce((sum, s) => sum + (s.total_ca || 0), 0);
        const totalScore = subjects.reduce((sum, s) => sum + (s.total || 0), 0);
        const averageScore = subjects.length > 0 ? totalScore / subjects.length : 0;
        const roundedAverage = Math.round(averageScore * 100) / 100;

        return {
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          admission_number: student.admission_number,
          class_name: classData?.name || '',
          subjects,
          total_ca_score: totalCaScore,
          total_score: totalScore,
          average_score: roundedAverage,
          final_grade: subjects.length > 0 ? gradeForAverage(roundedAverage) : null,
        };
      });

      // Calculate positions
      const sorted = [...entries].sort((a, b) => b.average_score - a.average_score);
      sorted.forEach((entry, index) => {
        entry.position = index + 1;
      });

      return entries;
    },
    enabled: !!classId && !!termId,
  });
}

// Shared fetch logic for a single student's report card in a single
// term. Used by both useStudentReportCard (staff/parent viewing any
// student) and useMyReportCard (a student viewing their own) — these
// used to be ~120 lines of copy-pasted logic each; consolidated so
// fixes (like the attendance summary below) only need to happen once.
async function fetchStudentReportCard(studentId: string, termId: string): Promise<StudentReportCard | null> {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      id, first_name, last_name, admission_number, class_id, avatar_url,
      class_arms (id, name)
    `)
    .eq('id', studentId)
    .single();

  if (studentError) throw studentError;

  // Get term and session info, including date range for attendance.
  const { data: term, error: termError } = await supabase
    .from('terms')
    .select(`
      id, name, session_id, start_date, end_date,
      academic_sessions (id, name)
    `)
    .eq('id', termId)
    .single();

  if (termError) throw termError;

  // Every subject the student's class actually takes (class_subjects),
  // not just ones with a legacy assessment_scores row — a student whose
  // teacher only ever used custom Broadsheet fields would otherwise show
  // zero subjects at all, even though they have real dynamic-field data.
  const { data: classSubjectRows, error: classSubjectsError } = await supabase
    .from('class_subjects')
    .select('subject_id, subjects (name)')
    .eq('class_id', student.class_id);

  if (classSubjectsError) throw classSubjectsError;

  // Legacy scores, kept as a left-join/fallback: still populated for any
  // school still entering scores into CA1-3/Exam directly, still used for
  // Grade/Total display when no grade-source Broadsheet field is set.
  const { data: scores, error: scoresError } = await supabase
    .from('assessment_scores')
    .select('*')
    .eq('student_id', studentId)
    .eq('term_id', termId);

  if (scoresError) throw scoresError;

  // Get class size and calculate position
  const { data: classmates } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', student.class_id)
    .eq('enrollment_status', 'active');

  const classSize = classmates?.length || 1;

  const subjects = (classSubjectRows || []).map(cs => {
    const score = (scores || []).find(s => s.subject_id === cs.subject_id);
    return {
      subject_id: cs.subject_id as string,
      subject_name: (cs as any).subjects?.name || 'Unknown',
      ca1: score?.ca1 ? Number(score.ca1) : null,
      ca2: score?.ca2 ? Number(score.ca2) : null,
      ca3: score?.ca3 ? Number(score.ca3) : null,
      exam: score?.exam ? Number(score.exam) : null,
      total: score?.total ? Number(score.total) : null,
      grade: score?.grade ?? null,
      remarks: score?.remarks ?? null,
    };
  });

  // Client-side fallback only — used when result_transcripts has no row
  // yet (see the summary object below for why this isn't the primary
  // source anymore).
  const totalScore = subjects.reduce((sum, s) => sum + (s.total || 0), 0);
  const averageScore = subjects.length > 0 ? totalScore / subjects.length : 0;

  // Get transcript for remarks and position
  const { data: transcript } = await supabase
    .from('result_transcripts')
    .select('*')
    .eq('student_id', studentId)
    .eq('term_id', termId)
    .maybeSingle();

  // Attendance summary for the term's date range. "School days opened"
  // is derived from the distinct dates this student has ANY attendance
  // status recorded — a reliable proxy for days the class was marked,
  // since attendance is taken for the whole class on the same days.
  let attendance = {
    times_present: 0,
    times_absent: 0,
    times_late: 0,
    times_excused: 0,
    school_days_opened: 0,
    dates_configured: false,
  };

  if (term.start_date && term.end_date) {
    // Only the student's own rows — RLS restricts students/parents to
    // their own/their child's attendance, so a classmate-wide query
    // would be silently filtered anyway for those viewers. "School
    // days opened" is derived from this same set (distinct dates the
    // student has ANY status recorded), which is a reliable proxy
    // since attendance is taken for the whole class on the same days —
    // it also avoids a second query and the RLS mismatch entirely.
    const { data: studentAttendance } = await supabase
      .from('attendance_records')
      .select('date, status')
      .eq('student_id', studentId)
      .gte('date', term.start_date)
      .lte('date', term.end_date);

    const records = studentAttendance || [];
    const distinctDates = new Set(records.map(r => r.date));

    attendance = {
      times_present: records.filter(r => r.status === 'present').length,
      times_absent: records.filter(r => r.status === 'absent').length,
      times_late: records.filter(r => r.status === 'late').length,
      times_excused: records.filter(r => r.status === 'excused').length,
      school_days_opened: distinctDates.size,
      dates_configured: true,
    };
  }

  // Behavioral (affective/psychomotor) ratings for this term.
  const { data: ratingRows } = await supabase
    .from('student_behavioral_ratings')
    .select('rating, behavioral_traits (domain, name, trait_order)')
    .eq('student_id', studentId)
    .eq('term_id', termId);

  const behavioral_ratings = {
    affective: (ratingRows || [])
      .filter((r: any) => r.behavioral_traits?.domain === 'affective')
      .sort((a: any, b: any) => (a.behavioral_traits?.trait_order || 0) - (b.behavioral_traits?.trait_order || 0))
      .map((r: any) => ({ trait_name: r.behavioral_traits?.name || '', rating: r.rating })),
    psychomotor: (ratingRows || [])
      .filter((r: any) => r.behavioral_traits?.domain === 'psychomotor')
      .sort((a: any, b: any) => (a.behavioral_traits?.trait_order || 0) - (b.behavioral_traits?.trait_order || 0))
      .map((r: any) => ({ trait_name: r.behavioral_traits?.name || '', rating: r.rating })),
  };

  // Grading scale — doubles as both the "keys to grades" legend and
  // the source for the grade analysis breakdown below.
  const { data: gradingScales } = await supabase
    .from('grading_scales')
    .select('grade, min_score, max_score, remark')
    .order('min_score', { ascending: false });

  const grading_legend = (gradingScales || []).map((g: any) => ({
    grade: g.grade,
    min_score: Number(g.min_score),
    max_score: Number(g.max_score),
    remark: g.remark,
  }));

  // How many of this student's subjects fell into each grade band —
  // only bands with at least one subject are included.
  const grade_analysis = grading_legend
    .map(g => ({
      grade: g.grade,
      remark: g.remark,
      count: subjects.filter(s => s.grade === g.grade).length,
    }))
    .filter(g => g.count > 0);

  return {
    student: {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      admission_number: student.admission_number,
      class_name: (student as any).class_arms?.name || '',
      avatar_url: (student as any).avatar_url || null,
    },
    term: {
      id: term.id,
      name: term.name,
    },
    session: {
      id: (term as any).academic_sessions?.id || '',
      name: (term as any).academic_sessions?.name || '',
    },
    subjects,
    summary: {
      // Prefer result_transcripts — recompute_class_transcripts (the same
      // function both the auto-trigger and "Force Recompute" call) already
      // handles both the grade-source-field path and the legacy
      // assessment_scores fallback correctly server-side. Only fall back
      // to a client-side sum here when no transcript row exists at all
      // yet (never computed once).
      total_score: transcript?.total_score != null ? Number(transcript.total_score) : totalScore,
      average_score: transcript?.average_score != null
        ? Number(transcript.average_score)
        : Math.round(averageScore * 100) / 100,
      position: transcript?.position || 0,
      class_size: transcript?.class_size || classSize,
    },
    attendance,
    behavioral_ratings,
    grade_analysis,
    grading_legend,
    remarks: {
      class_teacher: transcript?.class_teacher_remarks || null,
      principal: transcript?.principal_remarks || null,
    },
  };
}

// Fetch student report card
export function useStudentReportCard(studentId?: string, termId?: string) {
  return useQuery({
    queryKey: ['report-card', studentId, termId],
    queryFn: () => fetchStudentReportCard(studentId!, termId!),
    enabled: !!studentId && !!termId,
  });
}

// Get my report card (for students)
export function useMyReportCard(termId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-report-card', termId],
    queryFn: async (): Promise<StudentReportCard | null> => {
      if (!user || !termId) return null;

      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!studentData) return null;

      return fetchStudentReportCard(studentData.id, termId);
    },
    enabled: !!user && !!termId,
  });
}

// Save/update transcript
export function useSaveTranscript() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      student_id: string;
      session_id: string;
      term_id: string;
      total_subjects: number;
      total_score: number;
      average_score: number;
      position: number;
      class_size: number;
      principal_remarks?: string;
      class_teacher_remarks?: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: result, error } = await supabase
        .from('result_transcripts')
        .upsert({
          ...data,
          generated_by: user.id,
          generated_at: new Date().toISOString(),
        }, {
          onConflict: 'student_id,term_id',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet'] });
      queryClient.invalidateQueries({ queryKey: ['report-card', variables.student_id, variables.term_id] });
      queryClient.invalidateQueries({ queryKey: ['my-report-card', variables.term_id] });
      queryClient.invalidateQueries({ queryKey: ['student-transcript', variables.student_id] });
      toast.success('Transcript saved successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to save transcript: ' + error.message);
    },
  });
}

/**
 * "Commit to Transcript" — manual force-recompute of a whole class's
 * transcript rows for a term. Kept as a utility (e.g. after a bulk data
 * fix) even though it's no longer required for normal use — every score
 * against a school's designated grade-source field now triggers this
 * same recompute automatically (trg_auto_recompute_transcript), the way
 * a spreadsheet formula updates on any input change. Calls the identical
 * SQL function the trigger uses (recompute_class_transcripts), so there's
 * no separate logic here to drift out of sync with the automatic path.
 */
export function useCommitTranscripts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { classId: string; termId: string }) => {
      if (!user) throw new Error('User not authenticated');
      const { classId, termId } = params;

      const { count, error: countError } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');
      if (countError) throw countError;
      if (!count) return { committed: 0 };

      const { error } = await supabase.rpc('recompute_class_transcripts', {
        p_class_id: classId,
        p_term_id: termId,
        p_generated_by: user.id,
      });
      if (error) throw error;

      return { committed: count };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet'] });
      queryClient.invalidateQueries({ queryKey: ['report-card'] });
      queryClient.invalidateQueries({ queryKey: ['my-report-card'] });
      queryClient.invalidateQueries({ queryKey: ['student-transcript'] });
    },
    onError: (error: any) => {
      toast.error('Failed to commit transcripts: ' + error.message);
    },
  });
}

// Get full student transcript (all terms)
export function useStudentTranscript(studentId?: string) {
  return useQuery({
    queryKey: ['student-transcript', studentId],
    queryFn: async () => {
      if (!studentId) return null;

      const { data: transcripts, error } = await supabase
        .from('result_transcripts')
        .select(`
          *,
          terms (name, term_number),
          academic_sessions (name)
        `)
        .eq('student_id', studentId)
        .order('generated_at', { ascending: false });

      if (error) throw error;

      const { data: student } = await supabase
        .from('students')
        .select(`
          *,
          class_arms (name)
        `)
        .eq('id', studentId)
        .single();

      // Every subject the student's class takes (class_subjects) — not
      // just ones with a legacy assessment_scores row, same fix as
      // fetchStudentReportCard and for the same reason: a student whose
      // scores live entirely in custom Broadsheet fields would otherwise
      // show zero subjects for every term.
      const { data: classSubjectRows } = student?.class_id
        ? await supabase
            .from('class_subjects')
            .select('subject_id, subjects (name)')
            .eq('class_id', student.class_id)
        : { data: [] as any[] };

      const termIds = (transcripts || []).map(t => t.term_id);
      let legacyScoresByTerm: Record<string, Array<{
        subject_id: string;
        ca1: number | null; ca2: number | null; ca3: number | null;
        exam: number | null; total: number | null; grade: string | null;
      }>> = {};

      if (termIds.length > 0) {
        const { data: allScores, error: scoresError } = await supabase
          .from('assessment_scores')
          .select('term_id, subject_id, ca1, ca2, ca3, exam, total, grade')
          .eq('student_id', studentId)
          .in('term_id', termIds);

        if (scoresError) throw scoresError;

        legacyScoresByTerm = (allScores || []).reduce((acc, s) => {
          const key = s.term_id as string;
          if (!acc[key]) acc[key] = [];
          acc[key].push({
            subject_id: s.subject_id as string,
            ca1: s.ca1 !== null ? Number(s.ca1) : null,
            ca2: s.ca2 !== null ? Number(s.ca2) : null,
            ca3: s.ca3 !== null ? Number(s.ca3) : null,
            exam: s.exam !== null ? Number(s.exam) : null,
            total: s.total !== null ? Number(s.total) : null,
            grade: s.grade,
          });
          return acc;
        }, {} as typeof legacyScoresByTerm);
      }

      const subjectsByTerm: Record<string, Array<{
        subject_id: string;
        subject_name: string;
        ca1: number | null; ca2: number | null; ca3: number | null;
        exam: number | null; total: number | null; grade: string | null;
      }>> = {};
      for (const termId of termIds) {
        subjectsByTerm[termId] = (classSubjectRows || []).map((cs: any) => {
          const legacy = (legacyScoresByTerm[termId] || []).find(s => s.subject_id === cs.subject_id);
          return {
            subject_id: cs.subject_id as string,
            subject_name: cs.subjects?.name || 'Unknown',
            ca1: legacy?.ca1 ?? null,
            ca2: legacy?.ca2 ?? null,
            ca3: legacy?.ca3 ?? null,
            exam: legacy?.exam ?? null,
            total: legacy?.total ?? null,
            grade: legacy?.grade ?? null,
          };
        });
      }

      return {
        student,
        transcripts: (transcripts || []).map(t => ({
          ...t,
          subjects: subjectsByTerm[t.term_id] || [],
        })),
      };
    },
    enabled: !!studentId,
  });
}

/**
 * result_transcripts.position/class_size for every active student in one
 * class + term at once — Broadsheet's Final Summary "Position" column
 * needs a whole-class lookup rather than the single-student query
 * useStudentTranscript does. Read-only: position is only ever written by
 * recompute_class_transcripts (automatic on grade-source score changes,
 * or the manual "Force Recompute" fallback).
 */
export function useClassTranscriptPositions(classId?: string, termId?: string) {
  return useQuery({
    queryKey: ['result_transcripts', 'positions', classId, termId],
    queryFn: async (): Promise<Record<string, { position: number | null; class_size: number | null }>> => {
      if (!classId || !termId) return {};

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');

      if (studentsError) throw studentsError;
      const studentIds = (students || []).map(s => s.id);
      if (!studentIds.length) return {};

      const { data, error } = await supabase
        .from('result_transcripts')
        .select('student_id, position, class_size')
        .in('student_id', studentIds)
        .eq('term_id', termId);

      if (error) throw error;

      const byStudent: Record<string, { position: number | null; class_size: number | null }> = {};
      for (const row of data || []) {
        byStudent[row.student_id] = { position: row.position, class_size: row.class_size };
      }
      return byStudent;
    },
    enabled: !!classId && !!termId,
  });
}

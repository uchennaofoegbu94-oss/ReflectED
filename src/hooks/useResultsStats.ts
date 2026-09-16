import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolId } from './useSchoolId';

export interface ResultsStats {
  studentCount: number;
  resultsEnteredCount: number;
  classAverage: number;
  downloadCount: number;
}

export function useResultsStats() {
  const schoolId = useSchoolId();

  return useQuery({
    queryKey: ['results-stats', schoolId],
    queryFn: async (): Promise<ResultsStats> => {
      if (!schoolId) {
        return { studentCount: 0, resultsEnteredCount: 0, classAverage: 0, downloadCount: 0 };
      }

      // Scope "results entered" and "class average" to the active term —
      // an all-time count/average would mix terms together and mean
      // very little on a single glance-able stat card.
      const { data: activeTerm } = await supabase
        .from('terms')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      // "Results entered" still counts assessment_scores rows (legacy
      // per-subject entries) — that stays a meaningful count either way.
      // "Class average" now reads result_transcripts.average_score for
      // the active term instead: the same canonical per-student average
      // that Transcript/Broadsheet Final Average already use, computed
      // via recompute_class_transcripts/recompute_final_totals_for.
      // assessment_scores.total is sparse/stale for any school that has
      // moved to custom Broadsheet fields (it's only ever populated by
      // the 4 legacy CA1-3/Exam fields), which is what made this stat
      // read as a wrong, too-low number before.
      const [studentsRes, scoresRes, transcriptsRes, downloadsRes] = await Promise.all([
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),

        activeTerm
          ? supabase
              .from('assessment_scores')
              .select('total')
              .eq('school_id', schoolId)
              .eq('term_id', activeTerm.id)
              .limit(5000)
          : Promise.resolve({ data: [], error: null } as any),

        activeTerm
          ? supabase
              .from('result_transcripts')
              .select('average_score')
              .eq('school_id', schoolId)
              .eq('term_id', activeTerm.id)
              .not('average_score', 'is', null)
              .limit(5000)
          : Promise.resolve({ data: [], error: null } as any),

        supabase
          .from('report_downloads')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (scoresRes.error) throw scoresRes.error;
      if (transcriptsRes.error) throw transcriptsRes.error;
      if (downloadsRes.error) throw downloadsRes.error;

      const scores = (scoresRes.data || []) as { total: number | null }[];
      const transcriptAverages = (transcriptsRes.data || []) as { average_score: number | null }[];
      const averageValues = transcriptAverages.map((t) => Number(t.average_score) || 0);
      const classAverage = averageValues.length
        ? averageValues.reduce((sum, v) => sum + v, 0) / averageValues.length
        : 0;

      return {
        studentCount: studentsRes.count || 0,
        resultsEnteredCount: scores.length,
        classAverage: Math.round(classAverage * 10) / 10,
        downloadCount: downloadsRes.count || 0,
      };
    },
    enabled: !!schoolId,
  });
}

/** Call after a report card / transcript PDF is generated, to keep the
 * Downloads stat accurate. Best-effort — a failed log shouldn't block
 * the download the user already has in hand. */
export async function logReportDownload(
  schoolId: string,
  studentId: string,
  documentType: 'report_card' | 'transcript',
) {
  try {
    await supabase.from('report_downloads').insert({
      school_id: schoolId,
      student_id: studentId,
      document_type: documentType,
    });
  } catch {
    // Best-effort — do not surface this to the user.
  }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useSchoolId, withSchoolId } from './useSchoolId';

export type BroadsheetField = Database['public']['Tables']['broadsheet_fields']['Row'];
type BroadsheetFieldInsert = Database['public']['Tables']['broadsheet_fields']['Insert'];
type BroadsheetFieldScore = Database['public']['Tables']['broadsheet_field_scores']['Row'];

/**
 * Fields for one stage of the results pipeline ('pre_ca' | 'broadsheet' |
 * 'report_card'). Includes inactive fields — Manage Fields dialogs need
 * those to re-activate; scoring grids should filter to is_active
 * themselves.
 */
export function useBroadsheetFields(pipelineStage: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['broadsheet_fields', schoolId, pipelineStage],
    queryFn: async (): Promise<BroadsheetField[]> => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('broadsheet_fields')
        .select('*')
        .eq('school_id', schoolId)
        .eq('pipeline_stage', pipelineStage)
        .order('field_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}

export function useCreateBroadsheetField() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (field: Omit<BroadsheetFieldInsert, 'school_id' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = withSchoolId({ ...field, created_by: user?.id }, schoolId);
      const { data, error } = await supabase
        .from('broadsheet_fields')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet_fields'] });
    },
  });
}

export function useUpdateBroadsheetField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BroadsheetField> & { id: string }) => {
      const { data, error } = await supabase
        .from('broadsheet_fields')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet_fields'] });
    },
  });
}

export function useDeleteBroadsheetField() {
  const queryClient = useQueryClient();

  return useMutation({
    // Cascade RPC (not a raw row delete) — strips this field's id from
    // every other field's formula_source_field_ids across ALL pipeline
    // stages (and any saved mapping preset), recomputes whatever
    // computed fields lost a source, then deletes the row. Needed now
    // that computed fields can source the previous stage — a plain
    // delete would leave a dangling id in a cross-stage formula.
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_broadsheet_field_cascade', { _field_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet_fields'] });
      queryClient.invalidateQueries({ queryKey: ['broadsheet_field_scores'] });
    },
  });
}

/** What currently references a field — powers the delete-confirmation
 * warning. Covers computed-field formulas in any pipeline stage and
 * saved mapping presets; doesn't need to be scoped client-side. */
export function useBroadsheetFieldReferences(fieldId?: string) {
  return useQuery({
    queryKey: ['broadsheet_field_references', fieldId],
    queryFn: async () => {
      if (!fieldId) return { mapping_names: [], computed_field_names: [] };
      const { data, error } = await supabase.rpc('get_broadsheet_field_references', { _field_id: fieldId });
      if (error) throw error;
      const row = data?.[0];
      return {
        mapping_names: row?.mapping_names || [],
        computed_field_names: row?.computed_field_names || [],
      };
    },
    enabled: !!fieldId,
  });
}

/**
 * All field scores for one class + subject + term — the data behind a
 * Pre-CA/Broadsheet scoring grid. Keyed by active students in the class,
 * one row per (field, student) pair actually scored so far.
 */
export function useBroadsheetFieldScores(classId?: string, subjectId?: string, termId?: string) {
  return useQuery({
    queryKey: ['broadsheet_field_scores', classId, subjectId, termId],
    queryFn: async (): Promise<BroadsheetFieldScore[]> => {
      if (!classId || !subjectId || !termId) return [];

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');

      if (studentsError) throw studentsError;
      const studentIds = (students || []).map(s => s.id);
      if (!studentIds.length) return [];

      const { data, error } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .in('student_id', studentIds)
        .eq('subject_id', subjectId)
        .eq('term_id', termId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!classId && !!subjectId && !!termId,
  });
}

/**
 * The two system-computed 'final' scope fields for a class+term (Final
 * Total / Final Average) — subject-agnostic, one row per student per
 * field, auto-maintained server-side by recompute_final_totals() off of
 * every Broadsheet subject-scope field score. Read-only: there is no
 * corresponding write hook, these are never entered by hand.
 */
export function useBroadsheetFinalScores(classId?: string, termId?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['broadsheet_field_scores', 'finals', schoolId, classId, termId],
    queryFn: async (): Promise<BroadsheetFieldScore[]> => {
      if (!schoolId || !classId || !termId) return [];

      const { data: finalFields, error: fieldsError } = await supabase
        .from('broadsheet_fields')
        .select('id')
        .eq('school_id', schoolId)
        .eq('pipeline_stage', 'broadsheet')
        .eq('field_scope', 'final');

      if (fieldsError) throw fieldsError;
      const fieldIds = (finalFields || []).map(f => f.id);
      if (!fieldIds.length) return [];

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');

      if (studentsError) throw studentsError;
      const studentIds = (students || []).map(s => s.id);
      if (!studentIds.length) return [];

      const { data, error } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .in('field_id', fieldIds)
        .in('student_id', studentIds)
        .eq('term_id', termId)
        .is('subject_id', null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!classId && !!termId,
  });
}

/**
 * Writes one manually-entered score. Computed fields recompute themselves
 * server-side (trg_recompute_computed_fields) whenever a source field's
 * score changes — this mutation only ever targets non-computed fields;
 * the grid disables input on computed columns.
 */
export function useUpsertBroadsheetFieldScore() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (params: {
      field_id: string;
      student_id: string;
      subject_id: string;
      term_id: string;
      score: number | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = withSchoolId(
        { ...params, source_type: 'manual', entered_by: user?.id },
        schoolId,
      );
      const { data, error } = await supabase
        .from('broadsheet_field_scores')
        .upsert(payload, { onConflict: 'field_id,student_id,subject_id,term_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet_field_scores'] });
    },
  });
}

/**
 * "Push to <next stage>" — copies every active, push-target-configured
 * field's current score from one pipeline stage into its designated field
 * in the next stage (pre_ca -> broadsheet, or broadsheet -> report_card),
 * for one class + subject + term at a time. A deliberate, re-runnable
 * action (unlike a computed field, which recomputes live) — always
 * overwrites the target with whatever the source field currently holds.
 */
export interface PushConflict {
  studentId: string;
  studentName: string;
  fieldName: string;
  existingSourceLabel: string;
}

export interface PushResult {
  pushed: number;
  skipped: number;
  needsConfirmation?: boolean;
  conflicts?: PushConflict[];
}

/** Resolves a broadsheet_field_scores row's source_type/source_id into a
 * human-readable label for the collision-warning popup. */
export async function describeSource(sourceType: string | null, sourceId: string | null): Promise<string> {
  if (!sourceType || sourceType === 'manual') return 'manually entered';
  if (sourceType === 'computed') return 'a computed formula';
  if (sourceType === 'system_final') return 'the automatic Final Total/Average calculation';
  if (sourceType === 'pushed' && sourceId) {
    const { data } = await supabase.from('broadsheet_fields').select('name').eq('id', sourceId).maybeSingle();
    return data ? `a push from "${data.name}"` : 'an earlier push';
  }
  if (sourceType === 'assignment' && sourceId) {
    const { data } = await supabase.from('assignments').select('title').eq('id', sourceId).maybeSingle();
    return data ? `the assignment "${(data as any).title}"` : 'an assignment';
  }
  if (sourceType === 'quiz' && sourceId) {
    const { data } = await supabase.from('quizzes').select('title').eq('id', sourceId).maybeSingle();
    return data ? `the quiz "${(data as any).title}"` : 'a quiz';
  }
  return 'an earlier entry';
}

/**
 * "Push to <next stage>" — copies every active, push-target-configured
 * field's current score from one pipeline stage into its designated field
 * in the next stage (pre_ca -> broadsheet, or broadsheet -> report_card),
 * for one class + subject + term at a time. A deliberate, re-runnable
 * action (unlike a computed field, which recomputes live) — always
 * overwrites the target with whatever the source field currently holds.
 *
 * Two-phase: call once without `confirmed` — if any target cell already
 * holds a value, nothing is written and the result lists each conflict
 * (whose value it currently holds, per student) for a confirmation popup.
 * Call again with `confirmed: true` to actually overwrite everything,
 * conflicts included.
 */
export function usePushToNextStage(sourceStage: 'pre_ca' | 'broadsheet') {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (params: {
      classId: string; subjectId: string; termId: string; confirmed?: boolean;
    }): Promise<PushResult> => {
      const { classId, subjectId, termId, confirmed } = params;

      const { data: sourceFields, error: fieldsError } = await supabase
        .from('broadsheet_fields')
        .select('*')
        .eq('school_id', schoolId as string)
        .eq('pipeline_stage', sourceStage)
        .eq('is_active', true)
        .not('push_target_field_id', 'is', null);

      if (fieldsError) throw fieldsError;
      if (!sourceFields || !sourceFields.length) {
        return { pushed: 0, skipped: 0 };
      }

      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('class_id', classId)
        .eq('enrollment_status', 'active');

      if (studentsError) throw studentsError;
      const studentIds = (students || []).map(s => s.id);
      if (!studentIds.length) return { pushed: 0, skipped: 0 };

      const sourceFieldIds = sourceFields.map(f => f.id);
      const targetFieldIds = sourceFields.map(f => f.push_target_field_id as string);

      const { data: sourceScores, error: scoresError } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .in('field_id', sourceFieldIds)
        .in('student_id', studentIds)
        .eq('subject_id', subjectId)
        .eq('term_id', termId);

      if (scoresError) throw scoresError;

      const { data: existingTargetScores, error: existingError } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .in('field_id', targetFieldIds)
        .in('student_id', studentIds)
        .eq('subject_id', subjectId)
        .eq('term_id', termId);

      if (existingError) throw existingError;

      const { data: { user } } = await supabase.auth.getUser();
      let pushed = 0;
      let skipped = 0;
      const rows: any[] = [];
      const conflicts: PushConflict[] = [];

      for (const field of sourceFields) {
        for (const studentId of studentIds) {
          const source = (sourceScores || []).find(
            s => s.field_id === field.id && s.student_id === studentId,
          );
          if (!source || source.score === null) {
            skipped++;
            continue;
          }

          const existing = (existingTargetScores || []).find(
            s => s.field_id === field.push_target_field_id && s.student_id === studentId,
          );
          if (existing && existing.score !== null && !confirmed) {
            const student = (students || []).find(s => s.id === studentId);
            conflicts.push({
              studentId,
              studentName: student ? `${student.first_name} ${student.last_name}` : studentId,
              fieldName: field.name,
              existingSourceLabel: await describeSource(existing.source_type, existing.source_id),
            });
            continue;
          }

          rows.push(withSchoolId({
            field_id: field.push_target_field_id,
            student_id: studentId,
            subject_id: subjectId,
            term_id: termId,
            score: source.score,
            source_type: 'pushed',
            source_id: field.id,
            entered_by: user?.id,
          }, schoolId));
          pushed++;
        }
      }

      if (conflicts.length > 0 && !confirmed) {
        return { pushed: 0, skipped: 0, needsConfirmation: true, conflicts };
      }

      if (rows.length) {
        const { error: upsertError } = await supabase
          .from('broadsheet_field_scores')
          .upsert(rows, { onConflict: 'field_id,student_id,subject_id,term_id' });
        if (upsertError) throw upsertError;
      }

      return { pushed, skipped };
    },
    onSuccess: (result) => {
      if (!result.needsConfirmation) {
        queryClient.invalidateQueries({ queryKey: ['broadsheet_field_scores'] });
      }
    },
  });
}

/** Thin, stage-fixed wrapper — kept so PreCAView.tsx's existing import
 * doesn't need to change. */
export function usePushPreCAToBroadsheet() {
  return usePushToNextStage('pre_ca');
}

/** Broadsheet -> Report Card equivalent, used by the new push button on
 * BroadsheetView.tsx. */
export function usePushBroadsheetToReportCard() {
  return usePushToNextStage('broadsheet');
}

export type PipelineStageLock = Database['public']['Tables']['pipeline_stage_locks']['Row'];

/** Whether a pipeline stage's entry-mode behavior (manual vs push, per
 * field) is currently locked for teachers. Admin/principal can always
 * override regardless — the DB trigger (enforce_entry_mode) enforces
 * that distinction server-side too, this is just for the UI to reflect
 * the current lock state. */
export function usePipelineStageLock(pipelineStage: 'pre_ca' | 'broadsheet' | 'report_card') {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['pipeline_stage_locks', schoolId, pipelineStage],
    queryFn: async (): Promise<PipelineStageLock | null> => {
      if (!schoolId) return null;
      const { data, error } = await supabase
        .from('pipeline_stage_locks')
        .select('*')
        .eq('school_id', schoolId)
        .eq('pipeline_stage', pipelineStage)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });
}

export function useSetPipelineStageLock() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (params: { pipelineStage: 'pre_ca' | 'broadsheet' | 'report_card'; locked: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = withSchoolId({
        pipeline_stage: params.pipelineStage,
        locked: params.locked,
        locked_by: user?.id,
        locked_at: params.locked ? new Date().toISOString() : null,
      }, schoolId);
      const { error } = await supabase
        .from('pipeline_stage_locks')
        .upsert(payload, { onConflict: 'school_id,pipeline_stage' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stage_locks'] });
    },
  });
}

/**
 * Report Card no longer has its own separate fields — it mirrors active,
 * non-locked Broadsheet fields directly (admin/principal picks which ones
 * via a simple visibility toggle, ManageReportCardVisibilityDialog). Both
 * Report Card and Transcript views share this — same underlying fields,
 * each keeps its own table layout/style.
 */
export function useReportCardCustomFields() {
  const { data: fields = [], isLoading } = useBroadsheetFields('broadsheet');
  // Every active, non-locked Broadsheet field is toggle-controlled now —
  // including the legacy CA1/CA2/CA3/Exam ones. Report Card used to
  // hardcode those as separate, always-shown columns reading from
  // assessment_scores, which duplicated them for any school that had
  // ALSO created its own equivalents as regular Broadsheet fields (the
  // legacy path and the dynamic path showing the same concept twice,
  // with different — and for schools not using the legacy fields at all,
  // wrong/empty — numbers). One field list, one toggle system.
  const activeFields = fields
    .filter(f => f.is_active && !f.is_locked && f.show_on_report_card)
    .sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0));
  return { data: activeFields, isLoading };
}

/** Every show_on_report_card Broadsheet field's score, across every
 * subject, for one student + term — read live from Broadsheet's own
 * scores (no separate copy/push for this leg — see the migration note on
 * auto_push_to_next_stage). */
export function useReportCardCustomFieldScores(studentId?: string, termId?: string) {
  return useQuery({
    queryKey: ['broadsheet_field_scores', 'report_card_mirror', studentId, termId],
    queryFn: async (): Promise<BroadsheetFieldScore[]> => {
      if (!studentId || !termId) return [];
      const { data: fields, error: fieldsError } = await supabase
        .from('broadsheet_fields')
        .select('id')
        .eq('pipeline_stage', 'broadsheet')
        .eq('is_active', true)
        .eq('is_locked', false)
        .eq('show_on_report_card', true);
      if (fieldsError) throw fieldsError;
      const fieldIds = (fields || []).map(f => f.id);
      if (!fieldIds.length) return [];

      const { data, error } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .in('field_id', fieldIds)
        .eq('student_id', studentId)
        .eq('term_id', termId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId && !!termId,
  });
}

/** Same, but for every student in a set of terms at once — the Transcript
 * view shows multiple terms per student in one page. */
export function useReportCardCustomFieldScoresForTerms(studentId?: string, termIds?: string[]) {
  return useQuery({
    queryKey: ['broadsheet_field_scores', 'report_card_mirror_multi', studentId, termIds],
    queryFn: async (): Promise<BroadsheetFieldScore[]> => {
      if (!studentId || !termIds || !termIds.length) return [];
      const { data: fields, error: fieldsError } = await supabase
        .from('broadsheet_fields')
        .select('id')
        .eq('pipeline_stage', 'broadsheet')
        .eq('is_active', true)
        .eq('is_locked', false)
        .eq('show_on_report_card', true);
      if (fieldsError) throw fieldsError;
      const fieldIds = (fields || []).map(f => f.id);
      if (!fieldIds.length) return [];

      const { data, error } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .in('field_id', fieldIds)
        .eq('student_id', studentId)
        .in('term_id', termIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentId && !!termIds && termIds.length > 0,
  });
}

/** Toggles a single Broadsheet field's Report Card visibility — the only
 * write ManageReportCardVisibilityDialog ever does, no CRUD. */
export function useToggleShowOnReportCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldId, show }: { fieldId: string; show: boolean }) => {
      const { error } = await supabase
        .from('broadsheet_fields')
        .update({ show_on_report_card: show })
        .eq('id', fieldId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet_fields'] });
      queryClient.invalidateQueries({ queryKey: ['broadsheet_field_scores'] });
    },
  });
}

/**
 * Checks whether a Pre-CA field already has a value for a given subject
 * in the currently active term — used when a teacher is about to point a
 * NEW assignment/quiz at that field. Scores are per-student, but for a
 * config-time warning we only need to know what's THERE already (any one
 * row identifies the occupying source), not every student's row.
 */
export function useFieldTargetCollision(fieldId: string | null, subjectId?: string) {
  return useQuery({
    queryKey: ['field_target_collision', fieldId, subjectId],
    queryFn: async (): Promise<{ sourceLabel: string } | null> => {
      if (!fieldId || !subjectId) return null;

      const { data: activeTerm, error: termError } = await supabase
        .from('terms')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();
      if (termError) throw termError;
      if (!activeTerm) return null;

      const { data: existing, error } = await supabase
        .from('broadsheet_field_scores')
        .select('source_type, source_id')
        .eq('field_id', fieldId)
        .eq('subject_id', subjectId)
        .eq('term_id', activeTerm.id)
        .not('score', 'is', null)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!existing) return null;

      return { sourceLabel: await describeSource(existing.source_type, existing.source_id) };
    },
    enabled: !!fieldId && !!subjectId,
  });
}

/**
 * The school's designated "grade source" Broadsheet field, if any — the
 * one field whose per-subject score is used to compute the Grade badge
 * and feed Transcript totals under the new dynamic-field path. Independent
 * of show_on_report_card: a field can be the grade source without also
 * being shown as its own column (or vice versa).
 */
export function useGradeSourceField() {
  const { data: fields = [], isLoading } = useBroadsheetFields('broadsheet');
  const field = fields.find(f => f.is_active && !f.is_locked && f.is_grade_source) || null;
  return { data: field, isLoading };
}

export function useSetGradeSourceField() {
  const queryClient = useQueryClient();
  const schoolId = useSchoolId();

  return useMutation({
    mutationFn: async (fieldId: string | null) => {
      // Only one field can be the grade source at a time — clear any
      // existing one first (a plain UPDATE ... WHERE, not a full table
      // scan, since it's scoped to this school + stage).
      const { error: clearError } = await supabase
        .from('broadsheet_fields')
        .update({ is_grade_source: false })
        .eq('school_id', schoolId as string)
        .eq('pipeline_stage', 'broadsheet')
        .eq('is_grade_source', true);
      if (clearError) throw clearError;

      if (fieldId) {
        const { error } = await supabase
          .from('broadsheet_fields')
          .update({ is_grade_source: true })
          .eq('id', fieldId);
        if (error) throw error;

        // Catch up every class+term that already has data in this field —
        // otherwise students scored before the designation stay stale
        // until their next unrelated score edit.
        const { data: { user } } = await supabase.auth.getUser();
        const { error: recomputeError } = await supabase.rpc('recompute_transcripts_for_field', {
          p_field_id: fieldId,
          p_generated_by: user?.id,
        });
        if (recomputeError) throw recomputeError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadsheet_fields'] });
      queryClient.invalidateQueries({ queryKey: ['report-card'] });
      queryClient.invalidateQueries({ queryKey: ['my-report-card'] });
      queryClient.invalidateQueries({ queryKey: ['student-transcript'] });
    },
  });
}

/** Every score recorded against the grade-source field, across every
 * subject, for one student + term — separate from the show_on_report_card
 * custom-field scores since this field might not be one of those. */
export function useGradeSourceScores(fieldId?: string, studentId?: string, termId?: string) {
  return useQuery({
    queryKey: ['broadsheet_field_scores', 'grade_source', fieldId, studentId, termId],
    queryFn: async (): Promise<BroadsheetFieldScore[]> => {
      if (!fieldId || !studentId || !termId) return [];
      const { data, error } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .eq('field_id', fieldId)
        .eq('student_id', studentId)
        .eq('term_id', termId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!fieldId && !!studentId && !!termId,
  });
}

/** Same, but for every term in a set at once — Transcript needs the
 * grade-source field's scores across every term shown on one page. */
export function useGradeSourceScoresForTerms(fieldId?: string, studentId?: string, termIds?: string[]) {
  return useQuery({
    queryKey: ['broadsheet_field_scores', 'grade_source_multi', fieldId, studentId, termIds],
    queryFn: async (): Promise<BroadsheetFieldScore[]> => {
      if (!fieldId || !studentId || !termIds || !termIds.length) return [];
      const { data, error } = await supabase
        .from('broadsheet_field_scores')
        .select('*')
        .eq('field_id', fieldId)
        .eq('student_id', studentId)
        .in('term_id', termIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!fieldId && !!studentId && !!termIds && termIds.length > 0,
  });
}

/** The school's grading bands (min/max score -> grade/remark) — small,
 * fetched whole and matched client-side rather than one RPC call per
 * subject row. */
export function useGradingScales() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['grading_scales', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('grading_scales')
        .select('*')
        .eq('school_id', schoolId)
        .order('max_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}

/** Looks up the grade/remark for a score against a fetched grading-scale
 * list — same band logic as the compute_grade_for_school RPC. */
export function lookupGrade(scales: { min_score: number; max_score: number; grade: string; remark: string }[], score: number | null) {
  if (score === null || score === undefined) return null;
  return scales.find(s => score >= s.min_score && score <= s.max_score) || null;
}

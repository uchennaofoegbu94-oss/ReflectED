import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Loader2, Settings2, Sigma, Trophy, Download, ClipboardList, ArrowRightCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useClassArms } from '@/hooks/useClassArms';
import { useClassSubjects, useSubjects } from '@/hooks/useSubjects';
import { useTerms, useAcademicSessions } from '@/hooks/useAcademicData';
import { useStudents } from '@/hooks/useStudents';
import { useBroadsheet, useClassTranscriptPositions } from '@/hooks/useResults';
import { useCanDownloadBroadsheet } from '@/hooks/useAccessRestrictions';
import {
  useBroadsheetFields, useBroadsheetFieldScores, useBroadsheetFinalScores,
  useUpsertBroadsheetFieldScore, usePipelineStageLock, useGradingScales, lookupGrade,
} from '@/hooks/useBroadsheetFields';
import { generateBroadsheetPDF } from '@/lib/pdf';
import { ManagePipelineFieldsDialog } from './ManagePipelineFieldsDialog';

export function BroadsheetView() {
  const { user } = useAuth();
  const { school } = useSchool();
  const canManageFields = user?.role === 'admin' || user?.role === 'principal';
  const { canDownload, isLoading: downloadPermLoading } = useCanDownloadBroadsheet();

  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [termId, setTermId] = useState<string>('');
  const [manageOpen, setManageOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { data: classes = [] } = useClassArms();
  const { data: allSubjects = [] } = useSubjects();
  const { data: classSubjects = [] } = useClassSubjects();
  const { data: terms = [] } = useTerms();
  const { data: sessions = [] } = useAcademicSessions();
  const { data: allStudents = [] } = useStudents();
  const { data: allFields = [], isLoading: fieldsLoading } = useBroadsheetFields('broadsheet');
  const { data: scores = [], isLoading: scoresLoading } = useBroadsheetFieldScores(classId, subjectId, termId);
  const { data: finalScores = [], isLoading: finalsLoading } = useBroadsheetFinalScores(classId, termId);
  const upsertScore = useUpsertBroadsheetFieldScore();
  const { data: stageLock } = usePipelineStageLock('broadsheet');
  const isStageLocked = !!stageLock?.locked;
  const { data: gradingScales = [] } = useGradingScales();
  const { data: positions = {} } = useClassTranscriptPositions(classId, termId);

  // Whole-class, all-subjects view — separate data path from the per-subject
  // grid above, used only for the full Download PDF (position/rank across
  // every subject). Reads assessment_scores, which the sync_legacy_ca_column
  // trigger keeps in sync with the 4 legacy CA1-3/Exam fields entered here;
  // any *custom* Broadsheet fields an admin adds won't appear in this export
  // since there's no legacy column slot for them.
  const { data: fullBroadsheet = [] } = useBroadsheet(classId || undefined, termId || undefined);

  const subjectsForClass = useMemo(() => {
    if (!classId) return [];
    const subjectIds = new Set(classSubjects.filter((cs: any) => cs.class_id === classId).map((cs: any) => cs.subject_id));
    return allSubjects.filter((s: any) => subjectIds.has(s.id));
  }, [classId, classSubjects, allSubjects]);

  const students = useMemo(() => {
    if (!classId) return [];
    return (allStudents as any[])
      .filter(s => s.class_id === classId && s.enrollment_status === 'active')
      .sort((a, b) => `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`));
  }, [allStudents, classId]);

  const activeFields = useMemo(
    () => allFields
      .filter(f => f.is_active && !f.is_locked)
      .sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0)),
    [allFields],
  );

  // Explicit order (Total before Average) instead of alphabetical, which
  // put "Final Average" ahead of "Final Total" — backwards from how the
  // Report Card and Transcript both present them.
  const finalFieldDefs = useMemo(
    () => allFields
      .filter(f => f.field_scope === 'final')
      .sort((a, b) => {
        if (a.computation_key === 'final_total') return -1;
        if (b.computation_key === 'final_total') return 1;
        return a.name.localeCompare(b.name);
      }),
    [allFields],
  );

  const finalAverageField = useMemo(
    () => finalFieldDefs.find(f => f.computation_key === 'final_average') ?? null,
    [finalFieldDefs],
  );

  const scoreFor = (studentId: string, fieldId: string) =>
    scores.find(s => s.student_id === studentId && s.field_id === fieldId)?.score ?? null;

  const finalScoreFor = (studentId: string, fieldId: string) =>
    finalScores.find(s => s.student_id === studentId && s.field_id === fieldId)?.score ?? null;

  const positionFor = (studentId: string) => positions[studentId] ?? null;

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellDraft, setCellDraft] = useState<string>('');

  const commitCell = async (studentId: string, fieldId: string) => {
    const key = `${studentId}:${fieldId}`;
    setEditingCell(null);
    const trimmed = cellDraft.trim();
    const newValue = trimmed === '' ? null : Number(trimmed);
    const current = scoreFor(studentId, fieldId);
    if (newValue === current) return;
    if (newValue !== null && Number.isNaN(newValue)) {
      toast.error('Enter a valid number');
      return;
    }
    try {
      await upsertScore.mutateAsync({
        field_id: fieldId,
        student_id: studentId,
        subject_id: subjectId,
        term_id: termId,
        score: newValue,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save score — you may not have access to this class/subject');
    }
  };

  const selectedClass = classes.find((c: any) => c.id === classId);
  const selectedTerm = terms.find((t: any) => t.id === termId);
  const selectedSession = sessions.find((s: any) => s.id === (selectedTerm as any)?.session_id);

  const handleDownload = async () => {
    if (!school || !selectedClass || !selectedTerm) return;
    setDownloading(true);
    try {
      const subjectNames = Array.from(new Set(
        fullBroadsheet.flatMap((e: any) => e.subjects.map((s: any) => s.subject_name)),
      )).sort();
      const entries = (fullBroadsheet as any[]).map(e => ({
        position: e.position ?? null,
        student_name: e.student_name,
        admission_number: e.admission_number,
        subjects: e.subjects.map((s: any) => ({
          subject_name: s.subject_name,
          total_ca: s.total_ca,
          exam: s.exam,
          total: s.total,
          grade: s.grade,
        })),
        total_score: e.total_score,
        average_score: e.average_score,
        final_grade: e.final_grade,
      }));
      await generateBroadsheetPDF(
        school,
        {
          className: `${(selectedClass as any).name} ${(selectedClass as any).arm || ''}`.trim(),
          termName: selectedTerm.name,
          sessionName: selectedSession?.name,
        },
        subjectNames,
        entries,
      );
      toast.success('Broadsheet downloaded');
    } catch (err: any) {
      toast.error('Failed to generate broadsheet: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const readyForGrid = classId && subjectId && termId;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CA Broadsheet
          </CardTitle>
          <div className="flex items-center gap-2">
            {classId && termId && !downloadPermLoading && canDownload && (
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download
              </Button>
            )}
            {canManageFields && (
              <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Manage Fields
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-56">
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(''); }}>
              <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} {c.arm}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
              <SelectContent>
                {subjectsForClass.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
              <SelectContent>
                {terms.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!classId || !termId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a class and term to view Final Total/Average, and a subject to enter scores
          </div>
        ) : (
          <Tabs defaultValue="subject-scores">
            <TabsList>
              <TabsTrigger value="subject-scores" className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" />
                Subject Scores
              </TabsTrigger>
              <TabsTrigger value="final-summary" className="gap-1.5">
                <Trophy className="h-3.5 w-3.5" />
                Final Summary
              </TabsTrigger>
            </TabsList>

            {/* Subject Scores — CA1-3/Exam + any custom fields, one subject
                at a time (mirrors the Pre-CA tab's grid). */}
            <TabsContent value="subject-scores" className="pt-4">
              {!subjectId ? (
                <div className="text-center py-12 text-muted-foreground">
                  Select a subject to enter CA/Exam scores
                </div>
              ) : fieldsLoading || scoresLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeFields.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No Broadsheet fields set up yet.
                  {canManageFields ? (
                    <> Click "Manage Fields" above to add some.</>
                  ) : (
                    <> Ask an admin or principal to set some up.</>
                  )}
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No active students in this class
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10">Student</TableHead>
                        {activeFields.map(f => (
                          <TableHead key={f.id} className="text-center min-w-[100px]">
                            <div className="flex items-center justify-center gap-1">
                              {f.is_computed && <Sigma className="h-3 w-3 text-muted-foreground" />}
                              {f.name}
                            </div>
                            <div className="text-xs font-normal text-muted-foreground">/{f.max_points} pts</div>
                            {isStageLocked && !f.is_computed && (
                              <div className="text-[10px] font-normal text-muted-foreground">
                                {f.entry_mode === 'push' ? '🔒 push-only' : '🔒 manual-only'}
                              </div>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student: any) => (
                        <TableRow key={student.id}>
                          <TableCell className="sticky left-0 bg-background z-10">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage src={student.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">{student.first_name?.[0]}{student.last_name?.[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium whitespace-nowrap">
                                {student.first_name} {student.last_name}
                              </span>
                            </div>
                          </TableCell>
                          {activeFields.map(field => {
                            const key = `${student.id}:${field.id}`;
                            const value = scoreFor(student.id, field.id);
                            if (field.is_computed) {
                              return (
                                <TableCell key={field.id} className="text-center text-muted-foreground bg-muted/30">
                                  {value ?? '—'}
                                </TableCell>
                              );
                            }
                            return (
                              <TableCell key={field.id} className="text-center p-1">
                                {editingCell === key ? (
                                  <Input
                                    autoFocus
                                    type="number"
                                    className="h-8 w-20 mx-auto text-center"
                                    defaultValue={value ?? ''}
                                    onChange={(e) => setCellDraft(e.target.value)}
                                    onBlur={() => commitCell(student.id, field.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="h-8 w-16 mx-auto rounded hover:bg-muted transition-colors"
                                    onClick={() => { setEditingCell(key); setCellDraft(String(value ?? '')); }}
                                  >
                                    {value ?? <span className="text-muted-foreground">—</span>}
                                  </button>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Final Summary — Final Total/Average, subject-agnostic (spans
                every subject for the term), so only needs class+term. */}
            <TabsContent value="final-summary" className="pt-4">
              {finalFieldDefs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No Final Total/Average fields configured for this school yet.
                </div>
              ) : finalsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No active students in this class
                </div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        {finalFieldDefs.map(f => (
                          <TableHead key={f.id} className="text-center">{f.name}</TableHead>
                        ))}
                        <TableHead className="text-center">Final Grade</TableHead>
                        <TableHead className="text-center">Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student: any) => {
                        const avgValue = finalAverageField
                          ? finalScoreFor(student.id, finalAverageField.id)
                          : null;
                        const gradeBand = lookupGrade(gradingScales, avgValue);
                        const pos = positionFor(student.id);
                        return (
                          <TableRow key={student.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarImage src={student.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">{student.first_name?.[0]}{student.last_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium whitespace-nowrap">
                                  {student.first_name} {student.last_name}
                                </span>
                              </div>
                            </TableCell>
                            {finalFieldDefs.map(f => (
                              <TableCell key={f.id} className="text-center font-medium">
                                {finalScoreFor(student.id, f.id) ?? '—'}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-medium">
                              {gradeBand?.grade ?? '—'}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {pos?.position ? (
                                <span className="inline-flex items-center gap-1">
                                  <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                                  {pos.position}
                                  {pos.class_size ? ` / ${pos.class_size}` : ''}
                                </span>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      <ManagePipelineFieldsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        pipelineStage="broadsheet"
        title="Manage Broadsheet Fields"
      />
    </Card>
  );
}

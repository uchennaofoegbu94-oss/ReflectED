import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Layers, Loader2, Settings2, Sigma } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useClassArms } from '@/hooks/useClassArms';
import { useClassSubjects, useSubjects } from '@/hooks/useSubjects';
import { useTerms } from '@/hooks/useAcademicData';
import { useStudents } from '@/hooks/useStudents';
import {
  useBroadsheetFields, useBroadsheetFieldScores, useUpsertBroadsheetFieldScore,
  usePipelineStageLock,
} from '@/hooks/useBroadsheetFields';
import { ManagePipelineFieldsDialog } from './ManagePipelineFieldsDialog';

export function PreCAView() {
  const { user } = useAuth();
  const canManageFields = user?.role === 'admin' || user?.role === 'principal';

  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [termId, setTermId] = useState<string>('');
  const [manageOpen, setManageOpen] = useState(false);

  const { data: classes = [] } = useClassArms();
  const { data: allSubjects = [] } = useSubjects();
  const { data: classSubjects = [] } = useClassSubjects();
  const { data: terms = [] } = useTerms();
  const { data: allStudents = [] } = useStudents();
  const { data: fields = [], isLoading: fieldsLoading } = useBroadsheetFields('pre_ca');
  const { data: scores = [], isLoading: scoresLoading } = useBroadsheetFieldScores(classId, subjectId, termId);
  const upsertScore = useUpsertBroadsheetFieldScore();
  const { data: stageLock } = usePipelineStageLock('pre_ca');
  const isStageLocked = !!stageLock?.locked;

  // Subjects offered are only the ones actually assigned to the selected
  // class via class_subjects — matches how teacher scoping (can_manage_score_for)
  // works server-side, so the picker never offers a combination that would
  // just fail RLS on save.
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
    () => [...fields].filter(f => f.is_active).sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0)),
    [fields],
  );

  const scoreFor = (studentId: string, fieldId: string) =>
    scores.find(s => s.student_id === studentId && s.field_id === fieldId)?.score ?? null;

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

  const ready = classId && subjectId && termId;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Pre-CA
          </CardTitle>
          <div className="flex items-center gap-2">
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

        {!ready ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a class, subject, and term to enter Pre-CA scores
          </div>
        ) : fieldsLoading || scoresLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeFields.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No Pre-CA fields set up yet.
            {canManageFields ? (
              <> Click "Manage Fields" above to add some — e.g. "Quiz 1", "Homework Average".</>
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
      </CardContent>

      <ManagePipelineFieldsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        pipelineStage="pre_ca"
        title="Manage Pre-CA Fields"
      />
    </Card>
  );
}

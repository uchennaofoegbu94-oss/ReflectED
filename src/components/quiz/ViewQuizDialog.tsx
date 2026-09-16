import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEnhancedQuiz, useSetQuizBroadsheetField, useAddQuizQuestions, QuizQuestion } from '@/hooks/useEnhancedQuizzes';
import { useArchiveQuiz, useUnarchiveQuiz, useToggleQuizLock, useDeleteQuizQuestion, useSoftDeleteQuiz } from '@/hooks/useQuizzes';
import { useRepushGradesToPreCA } from '@/hooks/useEnhancedSubmissions';
import { EditQuestionDialog } from './EditQuestionDialog';
import { EditDraftQuestionDialog } from './EditDraftQuestionDialog';
import { PreCAFieldTargetSelector } from '@/components/results/PreCAFieldTargetSelector';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, FileQuestion, Users, CheckCircle2, Clock, Archive, ArchiveRestore, Lock, LockOpen, Pencil, Trash2, Download, ArrowRightCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ViewQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
}

export function ViewQuizDialog({ open, onOpenChange, quizId }: ViewQuizDialogProps) {
  const { user } = useAuth();
  const { data: quiz, isLoading } = useEnhancedQuiz(quizId);

  const isStaff = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';

  const archiveQuiz = useArchiveQuiz();
  const unarchiveQuiz = useUnarchiveQuiz();
  const softDeleteQuiz = useSoftDeleteQuiz();
  const toggleLock = useToggleQuizLock();
  const deleteQuestion = useDeleteQuizQuestion();
  const setBroadsheetField = useSetQuizBroadsheetField();
  const repushGrades = useRepushGradesToPreCA();
  const addQuestions = useAddQuizQuestions();
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [addingQuestion, setAddingQuestion] = useState(false);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!quiz) return null;

  const questions = quiz.quiz_questions || [];

  // Downloads questions in exactly the format handleImportFromText (in
  // EnhancedCreateQuizDialog) already parses when pasted — so a question
  // bank exported from one quiz can be pasted straight into another.
  const handleDownloadQuestions = () => {
    const lines: string[] = [];
    questions.forEach((q: any, idx: number) => {
      lines.push(`${idx + 1}. ${q.question_text}`);
      if (q.question_type === 'multiple_choice' && q.options) {
        (q.options as string[]).forEach((opt: string, i: number) => {
          const letter = String.fromCharCode(65 + i);
          const isCorrect = q.correct_answer === i;
          lines.push(`${letter}. ${opt}${isCorrect ? ' *' : ''}`);
        });
        if (typeof q.correct_answer === 'number') {
          lines.push(`Answer: ${String.fromCharCode(65 + q.correct_answer)}`);
        }
      } else if (q.question_type === 'true_false') {
        lines.push('A. True');
        lines.push('B. False');
        lines.push(`Answer: ${q.correct_answer === 0 ? 'A' : 'B'}`);
      }
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/[^a-z0-9]+/gi, '_')}_questions.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const attempts = quiz.quiz_attempts || [];
  const gradedAttempts = attempts.filter((a: any) => a.is_graded && a.total_score !== null);
  const avgScore = gradedAttempts.length > 0
    ? (gradedAttempts.reduce((sum: number, a: any) => sum + (a.total_score || 0), 0) / gradedAttempts.length).toFixed(1)
    : 'N/A';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-display">{quiz.title}</DialogTitle>
                <div className="flex gap-2 flex-wrap mt-2">
                  <Badge variant={quiz.is_active ? 'default' : 'secondary'}>
                    {quiz.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {quiz.is_locked && <Badge variant="destructive">Locked</Badge>}
                  {quiz.is_archived && <Badge variant="outline">Archived</Badge>}
                  <Badge variant="outline">{quiz.quiz_type.replace(/_/g, ' ')}</Badge>
                  {quiz.duration_minutes && (
                    <Badge variant="outline" className="gap-1">
                      <Clock size={12} /> {quiz.duration_minutes} min
                    </Badge>
                  )}
                </div>
              </div>
              {isStaff && (
                <div className="flex gap-2 shrink-0">
                  {questions.length > 0 && (
                    <Button size="sm" variant="outline" onClick={handleDownloadQuestions}>
                      <Download size={14} className="mr-1" /> Download
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleLock.mutate({ quizId, locked: !quiz.is_locked })}
                    disabled={toggleLock.isPending}
                  >
                    {quiz.is_locked
                      ? <><LockOpen size={14} className="mr-1" /> Unlock</>
                      : <><Lock size={14} className="mr-1" /> Lock</>}
                  </Button>
                  {quiz.is_archived ? (
                    <Button size="sm" variant="outline" onClick={() => unarchiveQuiz.mutate(quizId)} disabled={unarchiveQuiz.isPending}>
                      <ArchiveRestore size={14} className="mr-1" /> Reactivate
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => archiveQuiz.mutate(quizId)} disabled={archiveQuiz.isPending}>
                      <Archive size={14} className="mr-1" /> Archive
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${quiz.title}"? This can't be undone from here.`)) {
                        softDeleteQuiz.mutate(quizId, { onSuccess: () => onOpenChange(false) });
                      }
                    }}
                    disabled={softDeleteQuiz.isPending}
                  >
                    <Trash2 size={14} className="mr-1" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {quiz.description && (
            <p className="text-sm text-muted-foreground">{quiz.description}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-foreground">{questions.length}</p>
                <p className="text-xs text-muted-foreground">Questions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-foreground">{quiz.total_marks || quiz.total_points || 0}</p>
                <p className="text-xs text-muted-foreground">Total Marks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-foreground">{attempts.length}</p>
                <p className="text-xs text-muted-foreground">Attempts</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-foreground">{avgScore}</p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="questions" className="mt-2">
            <TabsList>
              <TabsTrigger value="questions" className="gap-1">
                <FileQuestion size={14} /> Questions
              </TabsTrigger>
              <TabsTrigger value="attempts" className="gap-1">
                <Users size={14} /> Attempts ({attempts.length})
              </TabsTrigger>
              {isStaff && (
                <TabsTrigger value="pre-ca" className="gap-1">
                  <ArrowRightCircle size={14} /> Pre-CA Push
                </TabsTrigger>
              )}
            </TabsList>

            {isStaff && (
              <TabsContent value="pre-ca" className="space-y-4 mt-4">
                <PreCAFieldTargetSelector
                  value={quiz.broadsheet_field_id ?? null}
                  onChange={(fieldId) => setBroadsheetField.mutate({ quizId, broadsheetFieldId: fieldId })}
                  subjectId={(quiz.classrooms as any)?.subject_id}
                  sourceLabel={quiz.title}
                  onConfirmReplace={async () => {
                    const result = await repushGrades.mutateAsync({ quizId });
                    toast.success(`Pushed ${result.count} attempt${result.count === 1 ? '' : 's'} to Pre-CA`);
                  }}
                />
                <div className="rounded-lg border p-3 bg-muted/30 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Push already-graded scores now</p>
                    <p className="text-xs text-muted-foreground">
                      New grades push automatically. Use this only if you set or changed the field above
                      after some attempts were already graded — {gradedAttempts.length} graded attempt
                      {gradedAttempts.length === 1 ? '' : 's'} won't re-push on their own.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={!quiz.broadsheet_field_id || repushGrades.isPending || gradedAttempts.length === 0}
                    onClick={async () => {
                      try {
                        const result = await repushGrades.mutateAsync({ quizId });
                        toast.success(`Pushed ${result.count} attempt${result.count === 1 ? '' : 's'} to Pre-CA`);
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to push grades');
                      }
                    }}
                  >
                    {repushGrades.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <ArrowRightCircle size={14} className="mr-1" />}
                    Push Now
                  </Button>
                </div>
              </TabsContent>
            )}

            <TabsContent value="questions" className="space-y-3 mt-4">
              {isStaff && (
                <Button size="sm" variant="outline" className="gap-1.5 mb-1" onClick={() => setAddingQuestion(true)}>
                  <Plus className="h-4 w-4" /> Add Question
                </Button>
              )}
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No questions added yet</p>
              ) : (
                questions
                  .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                  .map((q: any, idx: number) => (
                    <Card key={q.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">
                              <span className="text-muted-foreground mr-2">Q{idx + 1}.</span>
                              {q.question_text}
                            </p>
                            {q.question_type === 'multiple_choice' && q.options && (
                              <div className="mt-2 space-y-1">
                                {(q.options as string[]).map((opt: string, i: number) => {
                                  const isCorrect = q.correct_answer === i;
                                  return (
                                    <p
                                      key={i}
                                      className={`text-sm pl-4 ${isCorrect ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}
                                    >
                                      {String.fromCharCode(65 + i)}. {opt} {isCorrect && '✓'}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                            {q.question_type === 'true_false' && (
                              <p className="text-sm text-green-600 mt-1 pl-4">
                                Answer: {q.correct_answer === 0 ? 'True' : 'False'}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="outline">{q.points} pts</Badge>
                            <Badge variant="secondary" className="text-xs">
                              {q.question_type.replace(/_/g, ' ')}
                            </Badge>
                            {isStaff && (
                              <div className="flex gap-1 mt-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingQuestion(q)} title="Edit question">
                                  <Pencil size={12} />
                                </Button>
                                <Button
                                  size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                  onClick={() => deleteQuestion.mutate({ questionId: q.id, quizId })}
                                 title="Delete question">
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </TabsContent>

            <TabsContent value="attempts" className="space-y-3 mt-4">
              {attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No attempts yet</p>
              ) : (
                attempts.map((attempt: any) => (
                  <Card key={attempt.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Student ID: {attempt.student_id.slice(0, 8)}...</p>
                        {attempt.submitted_at && (
                          <p className="text-xs text-muted-foreground">
                            Submitted: {format(new Date(attempt.submitted_at), 'PPp')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">
                          {attempt.total_score !== null ? attempt.total_score : '-'}
                        </p>
                        <Badge variant={attempt.is_graded ? 'default' : 'secondary'}>
                          {attempt.is_graded ? (
                            <><CheckCircle2 size={12} className="mr-1" /> Graded</>
                          ) : 'Pending'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {editingQuestion && (
        <EditQuestionDialog
          open={!!editingQuestion}
          onOpenChange={(open) => !open && setEditingQuestion(null)}
          quizId={quizId}
          question={editingQuestion}
        />
      )}
      {addingQuestion && (
        <EditDraftQuestionDialog
          open
          onOpenChange={(o) => !o && setAddingQuestion(false)}
          question={{
            question_text: '',
            question_type: 'multiple_choice',
            points: 1,
            options: ['', ''],
            correct_answer: 0,
          }}
          onSave={async (q: QuizQuestion) => {
            try {
              await addQuestions.mutateAsync({ quizId, questions: [{ ...q, order_index: questions.length }] });
              setAddingQuestion(false);
            } catch (err: any) {
              toast.error(err.message || 'Failed to add question');
            }
          }}
        />
      )}
    </>
  );
}

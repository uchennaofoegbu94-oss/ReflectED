import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { useQuiz, useMyQuizAttempt } from '@/hooks/useQuizzes';

interface MyQuizResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
}

export function MyQuizResultDialog({ open, onOpenChange, quizId }: MyQuizResultDialogProps) {
  const { data: quiz, isLoading: quizLoading } = useQuiz(quizId);
  const { data: attempt, isLoading: attemptLoading } = useMyQuizAttempt(quizId);

  const isLoading = quizLoading || attemptLoading;
  const questions = quiz?.quiz_questions || [];
  const answersByQuestion = new Map((attempt?.quiz_answers || []).map((a: any) => [a.question_id, a]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quiz?.title || 'Quiz Result'}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !attempt ? (
          <p className="text-center py-12 text-muted-foreground">No attempt found for this quiz.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold">{attempt.total_score} / {quiz?.total_points}</p>
              <p className="text-sm text-muted-foreground">Your Score</p>
              <Badge variant={attempt.is_graded ? 'default' : 'secondary'} className="mt-2">
                {attempt.is_graded ? 'Fully Graded' : 'Pending Essay Grading'}
              </Badge>
            </div>

            {attempt.feedback && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Overall Feedback:</p>
                <p className="text-sm">{attempt.feedback}</p>
              </div>
            )}

            <div className="space-y-3">
              {questions.map((q: any, idx: number) => {
                const myAnswer = answersByQuestion.get(q.id);
                const isEssay = q.question_type === 'essay';
                const isCorrect = myAnswer?.is_correct;

                return (
                  <div key={q.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium">Q{idx + 1}. {q.question_text}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{q.points} pts</Badge>
                        {!isEssay && (
                          isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          )
                        )}
                        {isEssay && isCorrect === null && (
                          <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </div>

                    {isEssay ? (
                      <div className="space-y-2">
                        <div className="text-sm bg-muted/50 rounded p-2">
                          {myAnswer?.answer || <span className="text-muted-foreground italic">No answer submitted</span>}
                        </div>
                        {myAnswer?.feedback && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Feedback: </span>{myAnswer.feedback}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {myAnswer?.points_earned ?? 0} / {q.points} pts
                          {isCorrect === null && ' — awaiting grading'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {(q.options as string[])?.map((option: string, optIdx: number) => {
                          const isTheCorrectOption = q.correct_answer === optIdx;
                          const isMyPick = myAnswer?.answer === optIdx;
                          const label = q.question_type === 'true_false'
                            ? (optIdx === 0 ? 'True' : 'False')
                            : `${String.fromCharCode(65 + optIdx)}. ${option}`;

                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                                isTheCorrectOption
                                  ? 'bg-success/10 text-success font-medium'
                                  : isMyPick
                                    ? 'bg-destructive/10 text-destructive font-medium'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              {isTheCorrectOption && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                              {isMyPick && !isTheCorrectOption && <XCircle className="h-3.5 w-3.5 shrink-0" />}
                              <span>{label}</span>
                              {isMyPick && <span className="ml-auto text-xs opacity-70">Your answer</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

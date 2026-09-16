import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { 
  useQuiz, 
  useMyQuizAttempt, 
  useStartQuizAttempt, 
  useSubmitQuizAnswers,
  QuizWithDetails 
} from '@/hooks/useQuizzes';
import { Database } from '@/integrations/supabase/types';

type QuizQuestion = Database['public']['Tables']['quiz_questions']['Row'];

interface TakeQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
}

export function TakeQuizDialog({ open, onOpenChange, quizId }: TakeQuizDialogProps) {
  const { data: quiz, isLoading: quizLoading } = useQuiz(quizId);
  const { data: myAttempt, isLoading: attemptLoading } = useMyQuizAttempt(quizId);
  const startAttempt = useStartQuizAttempt();
  const submitAnswers = useSubmitQuizAnswers();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const questions = quiz?.quiz_questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  // Timer effect
  useEffect(() => {
    if (!hasStarted || !quiz?.duration_minutes || timeLeft === null) return;

    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [hasStarted, timeLeft]);

  const handleStart = async () => {
    if (!quiz) return;
    
    try {
      await startAttempt.mutateAsync(quizId);
      setHasStarted(true);
      setTimeLeft((quiz.duration_minutes || 60) * 60);
    } catch (error) {
      console.error('Failed to start quiz:', error);
    }
  };

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!myAttempt && !startAttempt.data) return;

    const attemptId = myAttempt?.id || startAttempt.data?.id;
    if (!attemptId) return;

    const formattedAnswers = Object.entries(answers).map(([question_id, answer]) => ({
      question_id,
      answer,
    }));

    await submitAnswers.mutateAsync({
      attemptId,
      answers: formattedAnswers,
      quizId,
    });

    onOpenChange(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (quizLoading || attemptLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            Loading quiz...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If already submitted
  if (myAttempt?.submitted_at) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Quiz Completed
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{myAttempt.total_score} / {quiz?.total_points}</p>
              <p className="text-muted-foreground">Your Score</p>
            </div>
            {myAttempt.feedback && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Feedback:</p>
                <p className="text-sm">{myAttempt.feedback}</p>
              </div>
            )}
            <Badge variant={myAttempt.is_graded ? 'default' : 'secondary'} className="w-full justify-center">
              {myAttempt.is_graded ? 'Fully Graded' : 'Pending Essay Grading'}
            </Badge>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Start screen
  if (!hasStarted && !myAttempt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{quiz?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            {quiz?.description && (
              <p className="text-muted-foreground">{quiz.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">{quiz?.duration_minutes} minutes</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">Total Points</p>
                <p className="font-medium">{quiz?.total_points}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">Questions</p>
                <p className="font-medium">{questions.length}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-muted-foreground">Passing Score</p>
                <p className="font-medium">{quiz?.passing_score}%</p>
              </div>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Once you start, the timer will begin. Make sure you have a stable internet connection.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={startAttempt.isPending}>
              {startAttempt.isPending ? 'Starting...' : 'Start Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Quiz in progress
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">{quiz?.title}</DialogTitle>
            {timeLeft !== null && (
              <Badge variant={timeLeft < 60 ? 'destructive' : 'secondary'} className="gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(timeLeft)}
              </Badge>
            )}
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </DialogHeader>

        <div className="py-6 min-h-[200px]">
          {currentQuestion && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-lg">{currentQuestion.question_text}</p>
                <Badge variant="outline">{currentQuestion.points} pts</Badge>
              </div>

              {currentQuestion.question_type === 'multiple_choice' && (
                <RadioGroup
                  value={answers[currentQuestion.id]?.toString() ?? ''}
                  onValueChange={(value) => handleAnswer(currentQuestion.id, parseInt(value))}
                >
                  {(currentQuestion.options as string[])?.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted">
                      <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                      <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                        {String.fromCharCode(65 + index)}. {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.question_type === 'true_false' && (
                <RadioGroup
                  value={answers[currentQuestion.id]?.toString() ?? ''}
                  onValueChange={(value) => handleAnswer(currentQuestion.id, parseInt(value))}
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted">
                    <RadioGroupItem value="0" id="true" />
                    <Label htmlFor="true" className="flex-1 cursor-pointer">True</Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted">
                    <RadioGroupItem value="1" id="false" />
                    <Label htmlFor="false" className="flex-1 cursor-pointer">False</Label>
                  </div>
                </RadioGroup>
              )}

              {currentQuestion.question_type === 'essay' && (
                <Textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  placeholder="Write your answer here..."
                  rows={6}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentQuestionIndex === questions.length - 1}
            >
              Next
            </Button>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={submitAnswers.isPending}
          >
            {submitAnswers.isPending ? 'Submitting...' : 'Submit Quiz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

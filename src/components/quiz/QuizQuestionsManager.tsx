import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Trash2, GripVertical, CheckCircle2, 
  Circle, FileText, ToggleLeft, Upload 
} from 'lucide-react';
import { useAddQuizQuestion, useDeleteQuizQuestion, QuizWithDetails } from '@/hooks/useQuizzes';
import { Database } from '@/integrations/supabase/types';
import { ImportQuestionsDialog } from './ImportQuestionsDialog';

type QuestionType = Database['public']['Enums']['question_type'];

interface QuizQuestionsManagerProps {
  quiz: QuizWithDetails;
}

export function QuizQuestionsManager({ quiz }: QuizQuestionsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [questionType, setQuestionType] = useState<QuestionType>('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<number | boolean>(0);
  const [gradingRubric, setGradingRubric] = useState('');

  const addQuestion = useAddQuizQuestion();
  const deleteQuestion = useDeleteQuizQuestion();

  const questions = quiz.quiz_questions || [];

  const handleAddQuestion = async () => {
    if (!questionText.trim()) return;

    let questionData: any = {
      quiz_id: quiz.id,
      question_type: questionType,
      question_text: questionText.trim(),
      points,
      order_index: questions.length,
    };

    if (questionType === 'multiple_choice') {
      questionData.options = options.filter(o => o.trim());
      questionData.correct_answer = correctAnswer;
    } else if (questionType === 'true_false') {
      questionData.options = ['True', 'False'];
      questionData.correct_answer = correctAnswer;
    } else if (questionType === 'essay') {
      questionData.grading_rubric = gradingRubric.trim() || null;
    }

    await addQuestion.mutateAsync(questionData);

    // Reset form
    setQuestionText('');
    setPoints(1);
    setOptions(['', '', '', '']);
    setCorrectAnswer(0);
    setGradingRubric('');
    setIsAdding(false);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      await deleteQuestion.mutateAsync({ questionId, quizId: quiz.id });
    }
  };

  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'multiple_choice': return <CheckCircle2 className="h-4 w-4" />;
      case 'true_false': return <ToggleLeft className="h-4 w-4" />;
      case 'essay': return <FileText className="h-4 w-4" />;
    }
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'multiple_choice': return 'Multiple Choice';
      case 'true_false': return 'True/False';
      case 'essay': return 'Essay';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImporting(true)} disabled={isAdding}>
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>
          <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
            <Plus className="h-4 w-4 mr-2" /> Add Question
          </Button>
        </div>
      </div>

      <ImportQuestionsDialog
        open={isImporting}
        onOpenChange={setIsImporting}
        quizId={quiz.id}
        startingIndex={questions.length}
      />


      {isAdding && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">New Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Question Type</Label>
                <Select value={questionType} onValueChange={(v) => setQuestionType(v as QuestionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="essay">Essay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  min={1}
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div>
              <Label>Question Text *</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter your question..."
                rows={2}
              />
            </div>

            {questionType === 'multiple_choice' && (
              <div className="space-y-3">
                <Label>Options (select correct answer)</Label>
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer(index)}
                      className={`p-1 rounded-full border-2 ${
                        correctAnswer === index 
                          ? 'border-primary bg-primary text-primary-foreground' 
                          : 'border-muted'
                      }`}
                    >
                      {correctAnswer === index ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                    <Input
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...options];
                        newOptions[index] = e.target.value;
                        setOptions(newOptions);
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {questionType === 'true_false' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <div className="flex gap-4">
                  <Button
                    variant={correctAnswer === 0 ? 'default' : 'outline'}
                    onClick={() => setCorrectAnswer(0)}
                  >
                    True
                  </Button>
                  <Button
                    variant={correctAnswer === 1 ? 'default' : 'outline'}
                    onClick={() => setCorrectAnswer(1)}
                  >
                    False
                  </Button>
                </div>
              </div>
            )}

            {questionType === 'essay' && (
              <div>
                <Label>Grading Rubric/Guidelines</Label>
                <Textarea
                  value={gradingRubric}
                  onChange={(e) => setGradingRubric(e.target.value)}
                  placeholder="Enter grading criteria for this essay question..."
                  rows={3}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddQuestion}
                disabled={!questionText.trim() || addQuestion.isPending}
              >
                {addQuestion.isPending ? 'Adding...' : 'Add Question'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {questions
          .sort((a, b) => a.order_index - b.order_index)
          .map((question, index) => (
            <Card key={question.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-5 w-5 cursor-move" />
                    <span className="font-medium">{index + 1}.</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium">{question.question_text}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          {getQuestionTypeIcon(question.question_type)}
                          {getQuestionTypeLabel(question.question_type)}
                        </Badge>
                        <Badge>{question.points} pts</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteQuestion(question.id)}
                         title="Delete question">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {(question.question_type === 'multiple_choice' || question.question_type === 'true_false') && 
                      question.options && (
                        <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                          {(question.options as string[]).map((opt, optIndex) => (
                            <div 
                              key={optIndex}
                              className={`flex items-center gap-2 px-2 py-1 rounded ${
                                optIndex === (question.correct_answer as number) 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                                  : ''
                              }`}
                            >
                              <span>{String.fromCharCode(65 + optIndex)}.</span>
                              <span>{opt}</span>
                              {optIndex === (question.correct_answer as number) && (
                                <CheckCircle2 className="h-3 w-3 ml-auto" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                    {question.question_type === 'essay' && question.grading_rubric && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Rubric: {question.grading_rubric}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {questions.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            No questions added yet. Click "Add Question" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

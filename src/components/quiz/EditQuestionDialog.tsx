import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, X } from 'lucide-react';
import { useUpdateQuizQuestion } from '@/hooks/useQuizzes';

interface EditQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  question: {
    id: string;
    question_type: 'multiple_choice' | 'true_false' | 'essay' | 'short_answer';
    question_text: string;
    points: number;
    options: string[] | null;
    correct_answer: any;
    grading_rubric: string | null;
  };
}

/** Previously the only way to change a question after creation was deleting
 * it and re-adding it from scratch, which also loses its position in the
 * question order. This edits it in place. */
export function EditQuestionDialog({ open, onOpenChange, quizId, question }: EditQuestionDialogProps) {
  const updateQuestion = useUpdateQuizQuestion();
  const [questionType, setQuestionType] = useState(question.question_type);
  const [questionText, setQuestionText] = useState(question.question_text);
  const [points, setPoints] = useState(String(question.points));
  const [options, setOptions] = useState<string[]>(question.options || ['', '']);
  const [correctIndex, setCorrectIndex] = useState<number>(
    typeof question.correct_answer === 'number' ? question.correct_answer : 0
  );
  const [gradingRubric, setGradingRubric] = useState(question.grading_rubric || '');

  useEffect(() => {
    if (open) {
      setQuestionType(question.question_type);
      setQuestionText(question.question_text);
      setPoints(String(question.points));
      setOptions(question.options || ['', '']);
      setCorrectIndex(typeof question.correct_answer === 'number' ? question.correct_answer : 0);
      setGradingRubric(question.grading_rubric || '');
    }
  }, [open, question]);

  const handleAddOption = () => setOptions([...options, '']);
  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== idx);
    setOptions(next);
    if (correctIndex >= next.length) setCorrectIndex(0);
  };
  const handleOptionChange = (idx: number, value: string) => {
    setOptions(options.map((o, i) => (i === idx ? value : o)));
  };

  const handleSave = async () => {
    if (!questionText.trim()) return;

    const updates: any = {
      question_type: questionType,
      question_text: questionText.trim(),
      points: Math.max(1, parseInt(points, 10) || 1),
    };

    if (questionType === 'multiple_choice') {
      const cleanOptions = options.map(o => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) return;
      updates.options = cleanOptions;
      updates.correct_answer = correctIndex;
      updates.grading_rubric = null;
    } else if (questionType === 'true_false') {
      updates.options = null;
      updates.correct_answer = correctIndex; // 0 = True, 1 = False
      updates.grading_rubric = null;
    } else {
      // essay / short_answer
      updates.options = null;
      updates.correct_answer = null;
      updates.grading_rubric = gradingRubric.trim() || null;
    }

    await updateQuestion.mutateAsync({ id: question.id, quizId, ...updates });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={questionType} onValueChange={(v: any) => setQuestionType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                  <SelectItem value="essay">Essay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Question</Label>
            <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} />
          </div>

          {questionType === 'multiple_choice' && (
            <div className="space-y-2">
              <Label>Options (select the correct one)</Label>
              <RadioGroup value={String(correctIndex)} onValueChange={(v) => setCorrectIndex(parseInt(v, 10))}>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <RadioGroupItem value={String(idx)} id={`opt-${idx}`} />
                    <Input value={opt} onChange={(e) => handleOptionChange(idx, e.target.value)} placeholder={`Option ${idx + 1}`} />
                    {options.length > 2 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => handleRemoveOption(idx)} title="Remove option">
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </RadioGroup>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleAddOption}>
                <Plus size={14} /> Add Option
              </Button>
            </div>
          )}

          {questionType === 'true_false' && (
            <div className="space-y-1.5">
              <Label>Correct Answer</Label>
              <RadioGroup value={String(correctIndex)} onValueChange={(v) => setCorrectIndex(parseInt(v, 10))}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="0" id="tf-true" />
                  <Label htmlFor="tf-true" className="font-normal">True</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="1" id="tf-false" />
                  <Label htmlFor="tf-false" className="font-normal">False</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {(questionType === 'essay' || questionType === 'short_answer') && (
            <div className="space-y-1.5">
              <Label>Grading Rubric / Guidelines (optional)</Label>
              <Textarea value={gradingRubric} onChange={(e) => setGradingRubric(e.target.value)} rows={2} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateQuestion.isPending || !questionText.trim()}>
            {updateQuestion.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

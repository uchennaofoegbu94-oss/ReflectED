import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, X } from 'lucide-react';
import { QuizQuestion } from '@/hooks/useEnhancedQuizzes';

interface EditDraftQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuizQuestion;
  onSave: (updated: QuizQuestion) => void;
}

// The DB-backed EditQuestionDialog (used from ViewQuizDialog, for a quiz
// that's already saved) persists via useUpdateQuizQuestion the moment you
// click Save. A question here hasn't been saved anywhere yet — it's still
// just an entry in the create-dialog's local `questions` array — so this
// is a separate, lighter component that hands the edited question back to
// the caller instead of writing to the database.
export function EditDraftQuestionDialog({ open, onOpenChange, question, onSave }: EditDraftQuestionDialogProps) {
  const [questionType, setQuestionType] = useState(question.question_type);
  const [questionText, setQuestionText] = useState(question.question_text);
  const [points, setPoints] = useState(String(question.points));
  const [options, setOptions] = useState<string[]>(question.options || ['', '']);
  const [correctIndex, setCorrectIndex] = useState<number>(
    typeof question.correct_answer === 'number' ? question.correct_answer : 0
  );
  const [gradingRubric, setGradingRubric] = useState((question as any).grading_rubric || '');

  useEffect(() => {
    if (open) {
      setQuestionType(question.question_type);
      setQuestionText(question.question_text);
      setPoints(String(question.points));
      setOptions(question.options || ['', '']);
      setCorrectIndex(typeof question.correct_answer === 'number' ? question.correct_answer : 0);
      setGradingRubric((question as any).grading_rubric || '');
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

  const handleSave = () => {
    if (!questionText.trim()) return;

    const updated: QuizQuestion = {
      ...question,
      question_type: questionType,
      question_text: questionText.trim(),
      points: Math.max(1, parseInt(points, 10) || 1),
    };

    if (questionType === 'multiple_choice') {
      const cleanOptions = options.map(o => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) return;
      updated.options = cleanOptions;
      updated.correct_answer = correctIndex;
    } else if (questionType === 'true_false') {
      updated.options = undefined;
      updated.correct_answer = correctIndex;
    } else {
      updated.options = undefined;
      updated.correct_answer = undefined;
      (updated as any).grading_rubric = gradingRubric.trim() || null;
    }

    onSave(updated);
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
                    <RadioGroupItem value={String(idx)} id={`draft-opt-${idx}`} />
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
                  <RadioGroupItem value="0" id="draft-tf-true" />
                  <Label htmlFor="draft-tf-true" className="font-normal">True</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="1" id="draft-tf-false" />
                  <Label htmlFor="draft-tf-false" className="font-normal">False</Label>
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
          <Button onClick={handleSave} disabled={!questionText.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

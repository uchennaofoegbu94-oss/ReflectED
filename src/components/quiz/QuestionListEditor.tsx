import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Pencil, Trash2, Plus, FileQuestion } from 'lucide-react';
import { QuizQuestion } from '@/hooks/useEnhancedQuizzes';
import { EditDraftQuestionDialog } from '@/components/quiz/EditDraftQuestionDialog';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  short_answer: 'Short Answer',
  essay: 'Essay',
};

const BLANK_QUESTION: QuizQuestion = {
  question_text: '',
  question_type: 'multiple_choice',
  points: 1,
  options: ['', ''],
  correct_answer: 0,
};

interface QuestionListEditorProps {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
  /** Shown when the list is empty, and above the Add button — lets each
   * caller (CBT assignment vs. adding to an existing quiz) explain itself. */
  emptyHint?: string;
}

/**
 * List + add/edit/remove for a QuizQuestion[] array, built on the existing
 * EditDraftQuestionDialog (already DB-agnostic — hands back an edited
 * question rather than saving it itself, which is exactly what's needed
 * here too). Purely a local-state editor; the caller decides what to do
 * with the resulting array (create a quiz+questions together, or add to
 * an existing one via useAddQuizQuestions).
 */
export function QuestionListEditor({ questions, onChange, emptyHint }: QuestionListEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const handleRemove = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const handleSaveEdit = (updated: QuizQuestion) => {
    if (editingIndex !== null) {
      onChange(questions.map((q, i) => (i === editingIndex ? updated : q)));
      setEditingIndex(null);
    } else if (adding) {
      onChange([...questions, { ...updated, order_index: questions.length }]);
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      {questions.length === 0 ? (
        <div className="text-center py-8 border rounded-lg border-dashed">
          <FileQuestion className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">{emptyHint || 'No questions yet'}</p>
        </div>
      ) : (
        questions.map((q, i) => (
          <Card key={i}>
            <CardContent className="py-3 flex items-start gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{i + 1}. {q.question_text}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[q.question_type]}</Badge>
                    <Badge className="text-xs">{q.points} pts</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingIndex(i)} title="Edit question">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemove(i)} title="Delete question">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {q.options && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {q.options.map((opt, oi) => (
                      <Badge key={oi} variant={q.correct_answer === oi ? 'default' : 'secondary'} className="text-xs">
                        {String.fromCharCode(65 + oi)}. {opt}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" /> Add Question
      </Button>

      {(editingIndex !== null || adding) && (
        <EditDraftQuestionDialog
          open
          onOpenChange={(o) => { if (!o) { setEditingIndex(null); setAdding(false); } }}
          question={editingIndex !== null ? questions[editingIndex] : BLANK_QUESTION}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

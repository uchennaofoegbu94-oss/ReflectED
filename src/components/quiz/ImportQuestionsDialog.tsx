import { useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Upload, FileText } from 'lucide-react';
import { useAddQuizQuestions } from '@/hooks/useEnhancedQuizzes';
import {
  parseQuestionsAuto,
  type ParsedQuestion,
} from '@/lib/parseQuestions';
import { toast } from 'sonner';

interface ImportQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  startingIndex: number;
}

const BLOCK_SAMPLE = `1. What is the capital of Nigeria?
A) Lagos
B) Abuja
C) Kano
D) Ibadan
ANSWER: B
POINTS: 1

2. The sun rises in the east.
TRUE/FALSE
ANSWER: True

3. Define photosynthesis.`;

const CSV_SAMPLE = `question,type,option_a,option_b,option_c,option_d,correct,points
"What is 2+2?",multiple_choice,1,2,3,4,D,1
"Water boils at 100C at sea level.",true_false,,,,,True,1
"Name the largest planet.",short_answer,,,,,Jupiter,2`;

export function ImportQuestionsDialog({
  open,
  onOpenChange,
  quizId,
  startingIndex,
}: ImportQuestionsDialogProps) {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const addQuestions = useAddQuizQuestions();

  const parsed: ParsedQuestion[] = useMemo(() => {
    if (!text.trim()) return [];
    try {
      return parseQuestionsAuto(text);
    } catch {
      return [];
    }
  }, [text]);

  const handleFile = async (file: File) => {
    const content = await file.text();
    setText(content);
  };

  const handleImport = async () => {
    if (parsed.length === 0) {
      toast.error('No valid questions detected.');
      return;
    }
    const renumbered = parsed.map((q, i) => ({
      ...q,
      order_index: startingIndex + i,
      marks: q.points,
    }));
    await addQuestions.mutateAsync({ quizId, questions: renumbered as any });
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Questions</DialogTitle>
          <DialogDescription>
            Paste questions in block format or CSV, or upload a .txt / .csv file. The parser will detect the format automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste" className="flex-1 overflow-hidden flex flex-col">
          <TabsList>
            <TabsTrigger value="paste">Paste / Upload</TabsTrigger>
            <TabsTrigger value="preview">
              Preview {parsed.length > 0 && <Badge className="ml-2">{parsed.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="help">Format Help</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="space-y-3 flex-1 overflow-auto">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" /> Upload file
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setText(BLOCK_SAMPLE)}
              >
                Load block sample
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setText(CSV_SAMPLE)}
              >
                Load CSV sample
              </Button>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your questions here..."
              className="font-mono text-sm min-h-[280px]"
            />
            <p className="text-sm text-muted-foreground">
              Detected: <strong>{parsed.length}</strong> question{parsed.length === 1 ? '' : 's'}
            </p>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[420px] pr-4">
              {parsed.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nothing to preview yet. Paste or upload questions on the previous tab.
                </p>
              ) : (
                <ol className="space-y-3">
                  {parsed.map((q, i) => (
                    <li key={i} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs uppercase text-muted-foreground">
                          {q.question_type.replace('_', ' ')}
                        </span>
                        <Badge variant="outline">{q.points} pt{q.points === 1 ? '' : 's'}</Badge>
                      </div>
                      <p className="font-medium text-sm">
                        {i + 1}. {q.question_text}
                      </p>
                      {q.options && (
                        <ul className="mt-2 space-y-1 text-sm">
                          {q.options.map((opt, idx) => (
                            <li
                              key={idx}
                              className={
                                q.correct_answer === idx
                                  ? 'text-success font-medium'
                                  : 'text-muted-foreground'
                              }
                            >
                              {String.fromCharCode(65 + idx)}) {opt}
                              {q.correct_answer === idx ? ' ✓' : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                      {q.question_type === 'short_answer' && q.correct_answer != null && (
                        <p className="text-sm mt-1">
                          <span className="text-muted-foreground">Answer:</span>{' '}
                          <span className="text-success">{String(q.correct_answer)}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="help" className="flex-1 overflow-auto space-y-4 text-sm">
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" /> Block format
              </h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{BLOCK_SAMPLE}</pre>
              <p className="text-muted-foreground mt-2">
                Separate questions with a blank line. Use <code>A) B) C) D)</code> for choices,
                <code> ANSWER:</code> to mark the correct one, and optional <code>POINTS:</code> for marks.
                A line of <code>TRUE/FALSE</code> (or just an ANSWER of True/False) creates a true/false question.
                Questions with no options become essay or short-answer.
              </p>
            </div>
            <div>
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4" /> CSV format
              </h4>
              <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{CSV_SAMPLE}</pre>
              <p className="text-muted-foreground mt-2">
                Header row required. <code>type</code> ∈ multiple_choice, true_false, short_answer, essay.
                For multiple_choice, <code>correct</code> is the letter (A–D). For true_false, <code>True</code> or <code>False</code>.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsed.length === 0 || addQuestions.isPending}
          >
            {addQuestions.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {parsed.length > 0 ? `${parsed.length} ` : ''}question{parsed.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

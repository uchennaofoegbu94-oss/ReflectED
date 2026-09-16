import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateQuiz } from '@/hooks/useQuizzes';

interface CreateQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
}

const QUIZ_TYPES = [
  { value: 'resumption', label: 'Resumption Test' },
  { value: 'mid_term', label: 'Mid-Term Test' },
  { value: 'weekly_test', label: 'Weekly Test' },
  { value: 'end_of_term_exam', label: 'End of Term Exam' },
];

export function CreateQuizDialog({ open, onOpenChange, classroomId }: CreateQuizDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizType, setQuizType] = useState<string>('weekly_test');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [totalPoints, setTotalPoints] = useState(100);
  const [passingScore, setPassingScore] = useState(50);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [allowReview, setAllowReview] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const createQuiz = useCreateQuiz();

  const handleCreate = async () => {
    if (!title.trim()) return;

    await createQuiz.mutateAsync({
      classroom_id: classroomId,
      title: title.trim(),
      description: description.trim() || null,
      quiz_type: quizType as any,
      duration_minutes: durationMinutes,
      total_points: totalPoints,
      passing_score: passingScore,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      allow_review: allowReview,
      scheduled_at: scheduledAt || null,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_active: false,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setQuizType('weekly_test');
    setDurationMinutes(60);
    setTotalPoints(100);
    setPassingScore(50);
    setShuffleQuestions(false);
    setShuffleOptions(false);
    setAllowReview(true);
    setScheduledAt('');
    setStartsAt('');
    setEndsAt('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Quiz</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="title">Quiz Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter quiz title"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter quiz description/instructions"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="quiz-type">Quiz Type *</Label>
              <Select value={quizType} onValueChange={setQuizType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUIZ_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)}
              />
            </div>

            <div>
              <Label htmlFor="total-points">Total Points</Label>
              <Input
                id="total-points"
                type="number"
                min={1}
                value={totalPoints}
                onChange={(e) => setTotalPoints(parseInt(e.target.value) || 100)}
              />
            </div>

            <div>
              <Label htmlFor="passing-score">Passing Score</Label>
              <Input
                id="passing-score"
                type="number"
                min={0}
                value={passingScore}
                onChange={(e) => setPassingScore(parseInt(e.target.value) || 50)}
              />
            </div>

            <div>
              <Label htmlFor="starts-at">Starts At</Label>
              <Input
                id="starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="ends-at">Ends At</Label>
              <Input
                id="ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="shuffle-questions"
                checked={shuffleQuestions}
                onCheckedChange={setShuffleQuestions}
              />
              <Label htmlFor="shuffle-questions">Shuffle Questions</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="shuffle-options"
                checked={shuffleOptions}
                onCheckedChange={setShuffleOptions}
              />
              <Label htmlFor="shuffle-options">Shuffle Options</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="allow-review"
                checked={allowReview}
                onCheckedChange={setAllowReview}
              />
              <Label htmlFor="allow-review">Allow Review</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!title.trim() || createQuiz.isPending}
          >
            {createQuiz.isPending ? 'Creating...' : 'Create Quiz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

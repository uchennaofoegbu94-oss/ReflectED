import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUpdateEnhancedAssignment, EnhancedAssignment } from '@/hooks/useEnhancedAssignments';
import { toast } from 'sonner';
import { Calendar, Clock, Loader2, Info } from 'lucide-react';

interface EditAssignmentDialogProps {
  assignment: EnhancedAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ASSIGNMENT_TYPES = [
  { value: 'holiday', label: 'Holiday Assignment' },
  { value: 'project', label: 'Project' },
  { value: 'weekend', label: 'Weekend Assignment' },
  { value: 'daily', label: 'Daily Assignment' },
  { value: 'weekly', label: 'Weekly Assignment' },
  { value: 'mid_term', label: 'Mid-Term Assignment' },
  { value: 'practical', label: 'Practical Work' },
];

// Scope note: this edits the same fields Create does EXCEPT classroom and
// content_type/CBT questions — reassigning the classroom after students
// may have already submitted, or switching a CBT assignment's questions,
// are bigger changes with their own implications (orphaned submissions,
// a linked quiz's question set) and aren't what useUpdateEnhancedAssignment
// itself persists anyway (it silently ignores classroom_id/broadsheet_field_id
// if passed — only the fields below are actually written). For a CBT
// assignment, Total Marks stays read-only here too, same as Create —
// it's driven by the linked quiz's question points, not typed directly.
export function EditAssignmentDialog({ assignment, open, onOpenChange }: EditAssignmentDialogProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [topic, setTopic] = useState('');
  const [assignmentType, setAssignmentType] = useState('weekly');
  const [totalMarks, setTotalMarks] = useState(100);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('23:59');
  const [allowLateSubmission, setAllowLateSubmission] = useState(true);
  const [latePenalty, setLatePenalty] = useState(0);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const updateAssignment = useUpdateEnhancedAssignment();
  const isCbt = assignment?.content_type === 'cbt';

  // Re-seed every field whenever a different assignment is opened for
  // editing (or the dialog re-opens on the same one after an external
  // change) — this dialog stays mounted between opens like the others in
  // this codebase, so a plain useState initializer alone would go stale.
  useEffect(() => {
    if (open && assignment) {
      setTitle(assignment.title || '');
      setInstructions(assignment.instructions || '');
      setTopic(assignment.topic || '');
      setAssignmentType(assignment.assignment_type || 'weekly');
      setTotalMarks(assignment.total_marks || assignment.points || 100);
      setDueDate(assignment.due_date ? assignment.due_date.slice(0, 10) : '');
      setDueTime(assignment.due_time || '23:59');
      setAllowLateSubmission(assignment.allow_late_submission ?? true);
      setLatePenalty(assignment.late_penalty_percent || 0);
      setStatus((assignment.status as 'draft' | 'published') || 'draft');
      setActiveTab('basic');
    }
  }, [open, assignment]);

  const handleSave = async (publishNow?: boolean) => {
    if (!assignment) return;
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    try {
      await updateAssignment.mutateAsync({
        id: assignment.id,
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        topic: topic.trim() || undefined,
        assignment_type: assignmentType,
        total_marks: isCbt ? undefined : totalMarks,
        due_date: dueDate || undefined,
        due_time: dueTime || undefined,
        allow_late_submission: allowLateSubmission,
        late_penalty_percent: allowLateSubmission ? latePenalty : 0,
        status: publishNow !== undefined ? (publishNow ? 'published' : 'draft') : status,
      });
      onOpenChange(false);
    } catch {
      // useUpdateEnhancedAssignment already toasts the error
    }
  };

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-title">Assignment Title *</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Math Homework 3"
              />
            </div>

            <div>
              <Label htmlFor="edit-instructions">Instructions / Description</Label>
              <Textarea
                id="edit-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Describe what students need to do..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-type">Assignment Type *</Label>
                <Select value={assignmentType} onValueChange={setAssignmentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-topic">Topic (optional)</Label>
                <Input
                  id="edit-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Algebra"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-marks">Total Marks</Label>
              {isCbt ? (
                <div className="h-10 flex items-center px-3 bg-muted rounded-md">
                  <span className="font-medium">{assignment.total_marks || assignment.points || 0}</span>
                  <span className="text-muted-foreground ml-1 text-sm">
                    pts — driven by this CBT's question points, not editable here
                  </span>
                </div>
              ) : (
                <Input
                  id="edit-marks"
                  type="number"
                  min={1}
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(parseInt(e.target.value) || 100)}
                />
              )}
            </div>

            <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Classroom and submission type can't be changed after an assignment is created — they'd
                orphan existing submissions{isCbt ? " or this CBT's linked quiz" : ''}.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-due-date">Due Date</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-due-time">Due Time</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-due-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Allow Late Submissions</p>
                <p className="text-sm text-muted-foreground">Students can submit after the due date</p>
              </div>
              <Switch checked={allowLateSubmission} onCheckedChange={setAllowLateSubmission} />
            </div>

            {allowLateSubmission && (
              <div>
                <Label htmlFor="edit-penalty">Late Submission Penalty (%)</Label>
                <Input
                  id="edit-penalty"
                  type="number"
                  min={0}
                  max={100}
                  value={latePenalty}
                  onChange={(e) => setLatePenalty(parseInt(e.target.value) || 0)}
                />
              </div>
            )}

            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'published')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => handleSave()} disabled={updateAssignment.isPending}>
            {updateAssignment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useGradeSubmission, SubmissionWithDetails } from '@/hooks/useSubmissions';
import {
  Loader2,
  Paperclip,
  Clock,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';

interface GradeSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubmissionWithDetails;
  assignmentId: string;
  maxPoints: number;
}

export function GradeSubmissionDialog({ 
  open, 
  onOpenChange, 
  submission,
  assignmentId,
  maxPoints
}: GradeSubmissionDialogProps) {
  const [grade, setGrade] = useState(submission.grade?.toString() || '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const gradeSubmission = useGradeSubmission();

  const handleGrade = async () => {
    const gradeNum = parseFloat(grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > maxPoints) {
      return;
    }
    
    await gradeSubmission.mutateAsync({
      submissionId: submission.id,
      grade: gradeNum,
      feedback: feedback.trim() || undefined,
      assignmentId,
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grade Submission</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Student Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Avatar>
              <AvatarImage src={submission.students?.avatar_url || ''} />
              <AvatarFallback>
                {submission.students?.first_name?.charAt(0)}
                {submission.students?.last_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">
                {submission.students?.first_name} {submission.students?.last_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {submission.students?.admission_number}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {submission.is_late && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  <Clock size={12} className="mr-1" />
                  Late
                </Badge>
              )}
              {submission.status === 'graded' && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                  <CheckCircle size={12} className="mr-1" />
                  Graded
                </Badge>
              )}
            </div>
          </div>
          
          {/* Submission Details */}
          <div>
            <Label className="text-muted-foreground">Submitted on</Label>
            <p className="text-foreground">
              {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>
          
          {submission.content && (
            <div>
              <Label className="text-muted-foreground">Student's Work</Label>
              <p className="text-foreground mt-1 whitespace-pre-wrap p-3 bg-muted rounded-lg max-h-40 overflow-y-auto">
                {submission.content}
              </p>
            </div>
          )}
          
          {submission.attachments && submission.attachments.length > 0 && (
            <div>
              <Label className="text-muted-foreground">Attachments</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {submission.attachments.map((att: any) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors"
                  >
                    <Paperclip size={14} />
                    {att.name}
                    <ExternalLink size={12} className="text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {/* Grading */}
          <div className="pt-4 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="grade">Grade (out of {maxPoints})</Label>
                <Input
                  id="grade"
                  type="number"
                  min={0}
                  max={maxPoints}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder={`0 - ${maxPoints}`}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                {grade && (
                  <Badge 
                    variant="outline" 
                    className={`text-lg px-4 py-2 ${
                      parseFloat(grade) >= maxPoints * 0.7 
                        ? 'bg-success/10 text-success border-success/30' 
                        : parseFloat(grade) >= maxPoints * 0.5 
                          ? 'bg-warning/10 text-warning border-warning/30'
                          : 'bg-destructive/10 text-destructive border-destructive/30'
                    }`}
                  >
                    {((parseFloat(grade) / maxPoints) * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <Label htmlFor="feedback">Feedback (optional)</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide feedback for the student..."
              className="mt-1 min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGrade}
            disabled={!grade || gradeSubmission.isPending}
            className="btn-accent"
          >
            {gradeSubmission.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Save Grade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

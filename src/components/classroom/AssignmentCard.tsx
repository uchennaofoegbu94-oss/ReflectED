import { useState } from 'react';
import { Calendar, Clock, Paperclip, Send, CheckCircle, MonitorPlay } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmissionDialog } from './SubmissionDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useMySubmission } from '@/hooks/useSubmissions';
import { useAssignmentLinkedQuiz } from '@/hooks/useEnhancedQuizzes';
import { useMyQuizAttempt } from '@/hooks/useQuizzes';
import { TakeQuizDialog } from '@/components/quiz/TakeQuizDialog';

interface AssignmentCardProps {
  assignment: {
    id: string;
    title: string;
    topic?: string | null;
    instructions?: string | null;
    due_date?: string | null;
    due_time?: string | null;
    points?: number | null;
    status?: string | null;
    content_type?: string | null;
    allow_late_submission?: boolean | null;
    attachments?: { id: string; name: string; url: string }[];
  };
  onClick?: () => void;
}

export function AssignmentCard({ assignment, onClick }: AssignmentCardProps) {
  const { user } = useAuth();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showTakeQuizDialog, setShowTakeQuizDialog] = useState(false);
  const isStudent = user?.role === 'student';
  const isCBT = assignment.content_type === 'cbt';

  const { data: mySubmission } = useMySubmission(isStudent && !isCBT ? assignment.id : undefined);
  const { data: linkedQuiz } = useAssignmentLinkedQuiz(isCBT ? assignment.id : undefined);
  const { data: myAttempt } = useMyQuizAttempt(isCBT ? linkedQuiz?.id : undefined);

  const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
  const hasSubmitted = isCBT ? !!myAttempt?.submitted_at : !!mySubmission;
  const isGraded = isCBT ? !!myAttempt?.is_graded : mySubmission?.status === 'graded';

  const handleSubmitClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCBT) {
      setShowTakeQuizDialog(true);
    } else {
      setShowSubmitDialog(true);
    }
  };
  
  return (
    <>
      <div
        className="assignment-card cursor-pointer group"
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-semibold text-foreground group-hover:text-secondary transition-colors">
              {assignment.title}
            </h4>
            {assignment.topic && (
              <p className="text-xs text-muted-foreground mt-0.5">{assignment.topic}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            {isCBT && (
              <Badge variant="outline" className="gap-1">
                <MonitorPlay size={12} /> CBT
              </Badge>
            )}
            {hasSubmitted && (
              <Badge 
                variant="outline" 
                className="bg-success/10 text-success border-success/30"
              >
                <CheckCircle size={12} className="mr-1" />
                {isGraded ? 'Graded' : 'Submitted'}
              </Badge>
            )}
            <Badge
              variant={assignment.status === 'published' ? 'default' : 'secondary'}
            >
              {assignment.status}
            </Badge>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {assignment.instructions}
        </p>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {assignment.due_date && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : ''}`}>
                <Calendar size={14} />
                <span>{new Date(assignment.due_date).toLocaleDateString()}</span>
              </div>
            )}
            {assignment.due_time && (
              <div className="flex items-center gap-1">
                <Clock size={14} />
                <span>{assignment.due_time}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {!isCBT && assignment.attachments && assignment.attachments.length > 0 && (
              <div className="flex items-center gap-1">
                <Paperclip size={14} />
                <span>{assignment.attachments.length}</span>
              </div>
            )}
            {assignment.points && (
              <Badge variant="outline">{assignment.points} pts</Badge>
            )}
          </div>
        </div>
        
        {/* Submit / take button for students */}
        {isStudent && assignment.status === 'published' && (!isCBT || linkedQuiz) && (
          <div className="mt-4 pt-3 border-t border-border">
            <Button 
              size="sm" 
              className={hasSubmitted ? 'w-full' : 'w-full btn-accent'}
              variant={hasSubmitted ? 'outline' : 'default'}
              onClick={handleSubmitClick}
            >
              {isCBT ? <MonitorPlay size={14} className="mr-2" /> : <Send size={14} className="mr-2" />}
              {isCBT
                ? (hasSubmitted ? 'View Result' : 'Take Assignment')
                : (hasSubmitted ? 'View Submission' : 'Submit Assignment')}
            </Button>
          </div>
        )}
      </div>
      
      {/* Submission Dialog (typed/upload assignments) */}
      {!isCBT && (
        <SubmissionDialog
          open={showSubmitDialog}
          onOpenChange={setShowSubmitDialog}
          assignment={assignment}
        />
      )}

      {/* CBT assignments are taken exactly like a quiz — the linked quiz row
          (quizzes.assignment_id) carries the questions, auto-grading, and
          this session's quiz->Pre-CA push, all already built. */}
      {isCBT && linkedQuiz && (
        <TakeQuizDialog
          open={showTakeQuizDialog}
          onOpenChange={setShowTakeQuizDialog}
          quizId={linkedQuiz.id}
        />
      )}
    </>
  );
}

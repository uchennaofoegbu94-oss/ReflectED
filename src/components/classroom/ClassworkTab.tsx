import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { AssignmentCard } from '@/components/classroom/AssignmentCard';
import { GradeSubmissionDialog } from '@/components/classroom/GradeSubmissionDialog';
import { useSubmissions, SubmissionWithDetails } from '@/hooks/useSubmissions';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Plus,
  BookOpen,
  Folder,
  ChevronDown,
  Loader2,
  Users,
  CheckCircle,
  Clock,
  ChevronLeft,
} from 'lucide-react';

interface ClassworkTabProps {
  isTeacher: boolean;
  isLoading: boolean;
  assignments: any[];
  createAssignment: any;
  uploadFile: (file: File) => Promise<any>;
  onShowCreateAssignment: () => void;
}

export function ClassworkTab({
  isTeacher,
  isLoading,
  assignments,
  onShowCreateAssignment,
}: ClassworkTabProps) {
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

  const groupedAssignments = assignments.reduce((acc, assignment) => {
    const topic = assignment.topic || 'Uncategorized';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(assignment);
    return acc;
  }, {} as Record<string, typeof assignments>);

  if (selectedAssignment && isTeacher) {
    return (
      <AssignmentSubmissionsView
        assignment={selectedAssignment}
        onBack={() => setSelectedAssignment(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold font-display">Classwork</h2>
        {isTeacher && (
          <Button className="btn-accent gap-2" onClick={onShowCreateAssignment}>
            <Plus size={18} />
            Create
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      ) : Object.keys(groupedAssignments).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{isTeacher ? 'Create your first assignment!' : 'No assignments yet.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAssignments).map(([topic, topicAssignments]: [string, any[]]) => (
            <div key={topic}>
              <button className="flex items-center gap-2 text-secondary font-medium mb-4">
                <Folder size={18} />
                {topic}
                <ChevronDown size={16} />
              </button>
              <div className="grid gap-4 md:grid-cols-2">
                {topicAssignments.map((assignment: any) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onClick={isTeacher ? () => setSelectedAssignment(assignment) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Teacher view to see all submissions for an assignment
function AssignmentSubmissionsView({ assignment, onBack }: { assignment: any; onBack: () => void }) {
  const { data: submissions = [], isLoading } = useSubmissions(assignment.id);
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionWithDetails | null>(null);

  const submittedCount = submissions.length;
  const gradedCount = submissions.filter(s => s.status === 'graded').length;
  const maxPoints = assignment.points || assignment.total_marks || 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft size={16} />
          Back
        </Button>
        <div>
          <h2 className="text-xl font-semibold font-display">{assignment.title}</h2>
          <p className="text-sm text-muted-foreground">
            {assignment.topic && `${assignment.topic} • `}
            {assignment.due_date ? `Due: ${new Date(assignment.due_date).toLocaleDateString()}` : 'No due date'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users size={20} className="mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold text-foreground">{submittedCount}</p>
            <p className="text-xs text-muted-foreground">Submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle size={20} className="mx-auto text-success mb-1" />
            <p className="text-2xl font-bold text-foreground">{gradedCount}</p>
            <p className="text-xs text-muted-foreground">Graded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock size={20} className="mx-auto text-warning mb-1" />
            <p className="text-2xl font-bold text-foreground">{submittedCount - gradedCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-secondary" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No submissions yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {submissions.map((submission) => (
            <Card key={submission.id} className="hover:border-secondary/50 transition-colors cursor-pointer" onClick={() => setGradingSubmission(submission)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={submission.students?.avatar_url || ''} />
                      <AvatarFallback>
                        {submission.students?.first_name?.charAt(0)}{submission.students?.last_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">
                        {submission.students?.first_name} {submission.students?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {submission.students?.admission_number} • Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {submission.is_late && (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Late</Badge>
                    )}
                    {submission.status === 'graded' ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                        {submission.grade}/{maxPoints}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">Pending</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Grading Dialog */}
      {gradingSubmission && (
        <GradeSubmissionDialog
          open={!!gradingSubmission}
          onOpenChange={(open) => !open && setGradingSubmission(null)}
          submission={gradingSubmission}
          assignmentId={assignment.id}
          maxPoints={maxPoints}
        />
      )}
    </div>
  );
}

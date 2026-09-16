import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Archive, FileQuestion, Calendar, Clock, Loader2, History } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ViewQuizDialog } from '@/components/quiz/ViewQuizDialog';
import { AssignmentGradingDialog } from '@/components/assignments/AssignmentGradingDialog';
import { useEnhancedAssignment } from '@/hooks/useEnhancedAssignments';

interface PastQuestionsTabProps {
  classroomId: string;
}

export function PastQuestionsTab({ classroomId }: PastQuestionsTabProps) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';

  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewQuizId, setViewQuizId] = useState<string | null>(null);
  const [viewAssignmentId, setViewAssignmentId] = useState<string | null>(null);

  // #1: archived quizzes/assignments belong here too, categorized apart
  // from merely-past ones — previously excluded entirely, since "archive"
  // used to mean the same thing as is_deleted (see the archive migration).
  const { data: pastQuizzes = [], isLoading } = useQuery({
    queryKey: ['past-questions', classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, description, quiz_type, content_type, total_marks, total_points, duration_minutes, created_at, starts_at, ends_at, is_active, is_archived')
        .eq('classroom_id', classroomId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Past = archived, OR ended/deactivated (the previous behavior).
      return (data || []).filter((q: any) => {
        if (q.is_archived) return true;
        if (!q.is_active) return true;
        if (q.ends_at && new Date(q.ends_at) < new Date()) return true;
        return false;
      });
    },
    enabled: !!classroomId,
  });

  const { data: pastAssignments = [] } = useQuery({
    queryKey: ['past-assignments', classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, title, instructions, topic, due_date, total_marks, points, assignment_type, created_at, is_archived')
        .eq('classroom_id', classroomId)
        .eq('is_deleted', false)
        .order('due_date', { ascending: false });
      if (error) throw error;
      // Past = archived, OR has a due date already gone by (the previous
      // behavior — an archived assignment with no/future due date now
      // shows too, since archiving is itself the "this is done" signal).
      return (data || []).filter((a: any) => {
        if (a.is_archived) return true;
        if (a.due_date && new Date(a.due_date) < new Date()) return true;
        return false;
      });
    },
    enabled: !!classroomId,
  });

  const filteredQuizzes = selectedType === 'all' || selectedType === 'quizzes' ? pastQuizzes : [];
  const filteredAssignments = selectedType === 'all' || selectedType === 'assignments' ? pastAssignments : [];

  const quizTypeLabels: Record<string, string> = {
    resumption: 'Resumption Test',
    weekly_test: 'Weekly Test',
    mid_term: 'Mid-Term Exam',
    end_of_term_exam: 'End of Term Exam',
    practice: 'Practice Quiz',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-secondary" />
      </div>
    );
  }

  const totalItems = pastQuizzes.length + pastAssignments.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Past Questions Archive</h3>
          <Badge variant="secondary">{totalItems} items</Badge>
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="quizzes">Quizzes/CBT</SelectItem>
            <SelectItem value="assignments">Assignments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {totalItems === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Archive className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium text-muted-foreground">No past questions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Completed and archived quizzes and assignments will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredQuizzes.map((quiz: any) => (
            <Card
              key={`quiz-${quiz.id}`}
              className={`transition-shadow ${isTeacher ? 'hover:shadow-sm cursor-pointer' : ''}`}
              onClick={() => isTeacher && setViewQuizId(quiz.id)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-secondary/10">
                      <FileQuestion className="h-4 w-4 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{quiz.title}</h4>
                      {quiz.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{quiz.description}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-xs capitalize">{quizTypeLabels[quiz.quiz_type] || quiz.quiz_type}</Badge>
                        {quiz.total_marks && <span className="text-xs text-muted-foreground">{quiz.total_marks} marks</span>}
                        {quiz.duration_minutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />{quiz.duration_minutes}min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {quiz.is_archived ? (
                      <Badge variant="outline" className="text-xs gap-1"><Archive className="h-3 w-3" /> Archived</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1"><History className="h-3 w-3" /> Past</Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                      <Calendar className="h-3 w-3" />
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredAssignments.map((assignment: any) => (
            <Card
              key={`assignment-${assignment.id}`}
              className={`transition-shadow ${isTeacher ? 'hover:shadow-sm cursor-pointer' : ''}`}
              onClick={() => isTeacher && setViewAssignmentId(assignment.id)}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileQuestion className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{assignment.title}</h4>
                      {assignment.instructions && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{assignment.instructions}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        {assignment.topic && <Badge variant="outline" className="text-xs">{assignment.topic}</Badge>}
                        <span className="text-xs text-muted-foreground">{assignment.total_marks || assignment.points || 100} marks</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    {assignment.is_archived ? (
                      <Badge variant="outline" className="text-xs gap-1"><Archive className="h-3 w-3" /> Archived</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs gap-1"><History className="h-3 w-3" /> Past</Badge>
                    )}
                    {assignment.due_date && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                        <Calendar className="h-3 w-3" />
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewQuizId && (
        <ViewQuizDialog
          open={!!viewQuizId}
          onOpenChange={(open) => !open && setViewQuizId(null)}
          quizId={viewQuizId}
        />
      )}

      {viewAssignmentId && (
        <PastAssignmentDialog
          assignmentId={viewAssignmentId}
          onClose={() => setViewAssignmentId(null)}
        />
      )}
    </div>
  );
}

// AssignmentGradingDialog needs the full assignment object, not just an id
// (unlike ViewQuizDialog, which fetches internally) — this small wrapper
// fetches it on demand only once a card is actually clicked.
function PastAssignmentDialog({ assignmentId, onClose }: { assignmentId: string; onClose: () => void }) {
  const { data: assignment, isLoading } = useEnhancedAssignment(assignmentId);

  if (isLoading || !assignment) return null;

  return (
    <AssignmentGradingDialog
      open={true}
      onOpenChange={(open) => !open && onClose()}
      assignment={assignment}
    />
  );
}

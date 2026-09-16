import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { EnhancedCreateQuizDialog } from '@/components/quiz/EnhancedCreateQuizDialog';
import { TakeQuizDialog } from '@/components/quiz/TakeQuizDialog';
import { MyQuizResultDialog } from '@/components/quiz/MyQuizResultDialog';
import { ViewQuizDialog } from '@/components/quiz/ViewQuizDialog';
import { useEnhancedQuizzes, useActivateQuiz, useDeactivateQuiz } from '@/hooks/useEnhancedQuizzes';
import { useUnarchiveQuiz, useSoftDeleteQuiz, useBulkArchiveQuizzes, useBulkSoftDeleteQuizzes, useToggleQuizLock } from '@/hooks/useQuizzes';
import { useMyClassrooms } from '@/hooks/useClassroomData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Plus,
  FileQuestion,
  Clock,
  CheckCircle2,
  Calendar,
  Play,
  Eye,
  Zap,
  XCircle,
  Users,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckSquare,
  X,
  Lock,
  LockOpen,
} from 'lucide-react';

export default function Quizzes() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';
  const isStudent = user?.role === 'student';
  
  const [activeTab, setActiveTab] = useState('active');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [takeQuizOpen, setTakeQuizOpen] = useState(false);
  const [viewQuizOpen, setViewQuizOpen] = useState(false);
  const [myResultOpen, setMyResultOpen] = useState(false);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>('');

  // Bulk-select: a lightweight selection mode toggled per-page rather than
  // always-on checkboxes, so the normal card layout/click targets stay
  // untouched until a teacher explicitly wants to act on several at once.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const bulkArchive = useBulkArchiveQuizzes();
  const bulkDelete = useBulkSoftDeleteQuizzes();
  const toggleLock = useToggleQuizLock();

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;
    bulkArchive.mutate(Array.from(selectedIds), { onSuccess: exitSelectMode });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected quiz${selectedIds.size === 1 ? '' : 'zes'}? This can't be undone from here.`)) return;
    bulkDelete.mutate(Array.from(selectedIds), { onSuccess: exitSelectMode });
  };


  // Resolved once, used to check per-card whether the student already
  // has an attempt (quiz.quiz_attempts is already embedded per quiz
  // from useEnhancedQuizzes, so this avoids an extra query per card).
  const { data: myStudentId } = useQuery({
    queryKey: ['my-student-id', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
      return data?.id || null;
    },
    enabled: isStudent && !!user,
  });
  
  // Get classrooms based on role
  const { data: classrooms = [] } = useMyClassrooms();
  
  // Auto-select first classroom if available
  const currentClassroomId = selectedClassroomId || (classrooms[0] as any)?.id || '';
  
  // Fetch enhanced quizzes for selected classroom
  const { data: allQuizzes = [], isLoading } = useEnhancedQuizzes(currentClassroomId);
  
  // Activation/Deactivation mutations
  const { mutate: activateQuiz } = useActivateQuiz();
  const { mutate: deactivateQuiz } = useDeactivateQuiz();
  const unarchiveQuiz = useUnarchiveQuiz();
  const softDeleteQuiz = useSoftDeleteQuiz();

  // Filter quizzes by status — archived quizzes are excluded from all three
  // (they have their own tab below), the same way is_deleted always was.
  const activeQuizzes = allQuizzes.filter((q: any) => q.is_active && !q.is_deleted && !q.is_archived);
  const scheduledQuizzes = allQuizzes.filter((q: any) => !q.is_active && q.scheduled_at && !q.is_deleted && !q.is_archived);
  const draftQuizzes = allQuizzes.filter((q: any) => !q.is_active && !q.scheduled_at && !q.is_deleted && !q.is_archived);
  const archivedQuizzes = allQuizzes.filter((q: any) => q.is_archived && !q.is_deleted);

  const getQuizTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      resumption: 'Resumption Test',
      mid_term: 'Mid-Term Exam',
      weekly_test: 'Weekly Test',
      end_of_term_exam: 'End of Term Exam',
      practice: 'Practice Quiz',
    };
    return labels[type] || type;
  };

  const getQuizTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      resumption: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      mid_term: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      weekly_test: 'bg-green-500/10 text-green-500 border-green-500/20',
      end_of_term_exam: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      practice: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  const handleTakeQuiz = (quizId: string) => {
    setSelectedQuizId(quizId);
    setTakeQuizOpen(true);
  };

  const handleViewResult = (quizId: string) => {
    setSelectedQuizId(quizId);
    setMyResultOpen(true);
  };

  // Separate from QuizCard: an archived quiz's actions are View / Reactivate
  // / Delete, not View / Activate-Deactivate — different enough to keep as
  // its own small component rather than branching QuizCard three ways.
  const ArchivedQuizCard = ({ quiz }: { quiz: any }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-display">{quiz.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {quiz.classrooms?.name || 'Classroom'}
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Archive size={12} /> Archived
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileQuestion size={14} />
          <span>{quiz.total_marks || quiz.total_points || 0} marks</span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => {
              setSelectedQuizId(quiz.id);
              setViewQuizOpen(true);
            }}
          >
            <Eye size={16} />
            View
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => unarchiveQuiz.mutate(quiz.id)}
            disabled={unarchiveQuiz.isPending}
          >
            <ArchiveRestore size={16} />
            Reactivate
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete "${quiz.title}"? This can't be undone from here.`)) {
                softDeleteQuiz.mutate(quiz.id);
              }
            }}
            disabled={softDeleteQuiz.isPending}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const QuizCard = ({ quiz }: { quiz: any }) => (
    <Card
      className={`hover:shadow-md transition-shadow ${selectMode && selectedIds.has(quiz.id) ? 'ring-2 ring-primary' : ''}`}
      onClick={selectMode ? () => toggleSelected(quiz.id) : undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            {selectMode && isTeacher && (
              <Checkbox
                checked={selectedIds.has(quiz.id)}
                onCheckedChange={() => toggleSelected(quiz.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
            )}
            <div className="flex-1">
              <CardTitle className="text-lg font-display">{quiz.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {quiz.classrooms?.name || 'Classroom'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={getQuizTypeBadgeColor(quiz.quiz_type)}>
              {getQuizTypeLabel(quiz.quiz_type)}
            </Badge>
            {quiz.is_locked && (
              <Badge variant="destructive" className="gap-1">
                <Lock size={11} />
                Locked
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {quiz.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {quiz.description}
          </p>
        )}
        <div className="space-y-2 text-sm">
          {quiz.duration_minutes && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock size={14} />
              <span>{quiz.duration_minutes} minutes</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileQuestion size={14} />
            <span>{quiz.total_marks || quiz.total_points || 0} marks</span>
          </div>
          {quiz.passing_score && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 size={14} />
              <span>Passing: {quiz.passing_score}%</span>
            </div>
          )}
          {quiz.ends_at && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar size={14} />
              <span>Ends: {format(new Date(quiz.ends_at), 'PPp')}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-2" onClick={(e) => selectMode && e.stopPropagation()}>
          {selectMode ? null : isStudent ? (
            (() => {
              const myAttempt = (quiz.quiz_attempts || []).find((a: any) => a.student_id === myStudentId);
              return myAttempt ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleViewResult(quiz.id)}
                >
                  <Eye size={16} />
                  View
                </Button>
              ) : (
                <Button
                  className="w-full gap-2"
                  onClick={() => handleTakeQuiz(quiz.id)}
                >
                  <Play size={16} />
                  Take Quiz
                </Button>
              );
            })()
          ) : (
            <>
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => {
                  setSelectedQuizId(quiz.id);
                  setViewQuizOpen(true);
                }}
              >
                <Eye size={16} />
                View
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => {
                  if (quiz.is_active) {
                    deactivateQuiz(quiz.id);
                  } else {
                    activateQuiz(quiz.id);
                  }
                }}
              >
                {quiz.is_active ? <XCircle size={16} /> : <Zap size={16} />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                title={quiz.is_locked ? 'Unlock quiz (make visible to students again)' : 'Lock quiz (hide from students)'}
                onClick={() => toggleLock.mutate({ quizId: quiz.id, locked: !quiz.is_locked })}
                disabled={toggleLock.isPending}
              >
                {quiz.is_locked ? <LockOpen size={16} /> : <Lock size={16} />}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">Quizzes & Tests</h1>
          <p className="text-muted-foreground mt-1">
            {isTeacher ? 'Create and manage CBT quizzes for your classrooms' : 'Take quizzes and view your results'}
          </p>
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              {selectMode ? <X size={18} /> : <CheckSquare size={18} />}
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
            <Button
              className="btn-accent gap-2"
              onClick={() => {
                if (!currentClassroomId && classrooms.length > 0) {
                  setSelectedClassroomId(classrooms[0]?.id);
                }
                setCreateDialogOpen(true);
              }}
            >
              <Plus size={18} />
              Create Quiz
            </Button>
          </div>
        )}
      </div>

      {/* Bulk-select action bar — appears once at least one quiz is
          checked, stays pinned so it's reachable after scrolling a long
          grid. Archive/Delete both fire a single batched request instead
          of one mutation per selected card. */}
      {selectMode && selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-lg border bg-card p-3 shadow-sm">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleBulkArchive} disabled={bulkArchive.isPending}>
              <Archive size={14} />
              Archive
            </Button>
            <Button variant="destructive" size="sm" className="gap-2" onClick={handleBulkDelete} disabled={bulkDelete.isPending}>
              <Trash2 size={14} />
              Delete
            </Button>
          </div>
        </div>
      )}
      {/* Classroom Selector */}
      {classrooms.length > 0 && (
        <div className="flex items-center gap-4">
          <Select value={currentClassroomId} onValueChange={setSelectedClassroomId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select a classroom" />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((classroom: any) => (
                <SelectItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-secondary/10 p-3 text-secondary">
              <FileQuestion size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{allQuizzes.length}</p>
              <p className="text-sm text-muted-foreground">Total Quizzes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-success/10 p-3 text-success">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeQuizzes.length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="rounded-xl bg-warning/10 p-3 text-warning">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{scheduledQuizzes.length}</p>
              <p className="text-sm text-muted-foreground">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        {isTeacher && (
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-xl bg-muted p-3 text-muted-foreground">
                <FileQuestion size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{draftQuizzes.length}</p>
                <p className="text-sm text-muted-foreground">Drafts</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Play size={16} />
            Active Quizzes
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="gap-2">
            <Calendar size={16} />
            Scheduled
          </TabsTrigger>
          {isTeacher && (
            <TabsTrigger value="drafts" className="gap-2">
              <FileQuestion size={16} />
              Drafts
            </TabsTrigger>
          )}
          {isTeacher && (
            <TabsTrigger value="results" className="gap-2">
              <Users size={16} />
              Results
            </TabsTrigger>
          )}
          {isTeacher && (
            <TabsTrigger value="archived" className="gap-2">
              <Archive size={16} />
              Archived
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading quizzes...</div>
          ) : activeQuizzes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">No active quizzes</h3>
                <p className="text-muted-foreground mt-2">
                  {isTeacher ? 'Create a new quiz to get started' : 'Check back later for new quizzes'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeQuizzes.map((quiz: any) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="mt-6">
          {scheduledQuizzes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">No scheduled quizzes</h3>
                <p className="text-muted-foreground mt-2">
                  {isTeacher ? 'Schedule a quiz for a future date' : 'No upcoming quizzes scheduled'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scheduledQuizzes.map((quiz: any) => (
                <QuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          )}
        </TabsContent>

        {isTeacher && (
          <TabsContent value="drafts" className="mt-6">
            {draftQuizzes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">No draft quizzes</h3>
                  <p className="text-muted-foreground mt-2">
                    Create a new quiz and save as draft to get started
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {draftQuizzes.map((quiz: any) => (
                  <QuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {isTeacher && (
          <TabsContent value="results" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Quiz Results Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Select a quiz above to view detailed student results and grades.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isTeacher && (
          <TabsContent value="archived" className="mt-6">
            {archivedQuizzes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Archive className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">No archived quizzes</h3>
                  <p className="text-muted-foreground mt-2">
                    Quizzes you archive from the View dialog will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedQuizzes.map((quiz: any) => (
                  <ArchivedQuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <EnhancedCreateQuizDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultClassroomId={currentClassroomId}
      />

      {selectedQuizId && isStudent && (
        <TakeQuizDialog
          open={takeQuizOpen}
          onOpenChange={setTakeQuizOpen}
          quizId={selectedQuizId}
        />
      )}

      {selectedQuizId && isStudent && (
        <MyQuizResultDialog
          open={myResultOpen}
          onOpenChange={setMyResultOpen}
          quizId={selectedQuizId}
        />
      )}

      {selectedQuizId && isTeacher && (
        <ViewQuizDialog
          open={viewQuizOpen}
          onOpenChange={setViewQuizOpen}
          quizId={selectedQuizId}
        />
      )}
    </div>
  );
}

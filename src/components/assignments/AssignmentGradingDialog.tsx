 import { useState } from 'react';
 import { useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Badge } from '@/components/ui/badge';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { 
   useAssignmentSubmissions, 
   useGradeEnhancedSubmission,
   useBulkGradeSubmissions,
   useAssessmentAnalytics,
   useRepushGradesToPreCA,
   EnhancedSubmission 
 } from '@/hooks/useEnhancedSubmissions';
 import {
   EnhancedAssignment, useArchiveEnhancedAssignment, useUnarchiveEnhancedAssignment,
   useToggleAssignmentLock, useDeleteEnhancedAssignment,
 } from '@/hooks/useEnhancedAssignments';
 import { useAssignmentLinkedQuiz, useSetQuizBroadsheetField } from '@/hooks/useEnhancedQuizzes';
 import { useQuizAttempts } from '@/hooks/useQuizzes';
 import { PreCAFieldTargetSelector } from '@/components/results/PreCAFieldTargetSelector';
 import { format } from 'date-fns';
 import { toast } from 'sonner';
 import {
   User,
   Clock,
   CheckCircle2,
   AlertCircle,
   FileText,
   Download,
   ExternalLink,
   ChevronLeft,
   ChevronRight,
   Loader2,
   BarChart3,
   Users,
   TrendingUp,
   Archive,
   ArchiveRestore,
   Lock,
   LockOpen,
   ArrowRightCircle,
   Trash2,
 } from 'lucide-react';
 
 interface AssignmentGradingDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   assignment: EnhancedAssignment;
 }
 
 export function AssignmentGradingDialog({ open, onOpenChange, assignment }: AssignmentGradingDialogProps) {
   const queryClient = useQueryClient();
   const [selectedSubmission, setSelectedSubmission] = useState<EnhancedSubmission | null>(null);
   const [grade, setGrade] = useState('');
   const [feedback, setFeedback] = useState('');
   const [activeTab, setActiveTab] = useState('submissions');
 
   const { data: submissions = [], isLoading } = useAssignmentSubmissions(assignment.id);
   const { data: analytics } = useAssessmentAnalytics('assignment', assignment.id);
  const gradeSubmission = useGradeEnhancedSubmission();
  const archiveAssignment = useArchiveEnhancedAssignment();
  const unarchiveAssignment = useUnarchiveEnhancedAssignment();
  const toggleLock = useToggleAssignmentLock();
  const deleteAssignment = useDeleteEnhancedAssignment();
  const repushGrades = useRepushGradesToPreCA();
  // CBT assignments never produce `submissions` rows at all — students take
  // them exactly like a quiz, writing to quiz_attempts instead (auto-graded
  // there the same way a normal quiz is). This dialog would otherwise
  // always show "no submissions" for a CBT assignment even after every
  // student completed and got auto-graded — not because grading failed,
  // but because it was looking in the wrong table entirely.
  const isCBT = assignment.content_type === 'cbt';
  const { data: linkedQuiz } = useAssignmentLinkedQuiz(isCBT ? assignment.id : undefined);
  const { data: quizAttempts = [], isLoading: attemptsLoading } = useQuizAttempts(linkedQuiz?.id);
  const setQuizBroadsheetField = useSetQuizBroadsheetField();

   const pendingSubmissions = submissions.filter(s => s.status !== 'graded');
   const gradedSubmissions = submissions.filter(s => s.status === 'graded');
   const totalMarks = assignment.total_marks || assignment.points || 100;
 
   const handleSelectSubmission = (submission: EnhancedSubmission) => {
     setSelectedSubmission(submission);
     setGrade(submission.grade?.toString() || '');
     setFeedback(submission.feedback || '');
   };
 
   const handleGrade = async () => {
     if (!selectedSubmission || !grade) return;
 
     await gradeSubmission.mutateAsync({
       submissionId: selectedSubmission.id,
       grade: parseFloat(grade),
       feedback: feedback.trim() || undefined,
       assignmentId: assignment.id,
     });
 
     // Move to next pending submission
     const currentIndex = submissions.findIndex(s => s.id === selectedSubmission.id);
     const nextPending = submissions.find((s, i) => i > currentIndex && s.status !== 'graded');
     if (nextPending) {
       handleSelectSubmission(nextPending);
     } else {
       setSelectedSubmission(null);
       setGrade('');
       setFeedback('');
     }
   };
 
   const navigateSubmission = (direction: 'prev' | 'next') => {
     if (!selectedSubmission) return;
     const currentIndex = submissions.findIndex(s => s.id === selectedSubmission.id);
     const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
     if (newIndex >= 0 && newIndex < submissions.length) {
       handleSelectSubmission(submissions[newIndex]);
     }
   };
 
   const getStudentInitials = (student: EnhancedSubmission['students']) => {
     if (!student) return 'ST';
     return `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
         <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Grade Submissions: {assignment.title}
              {assignment.is_archived && <Badge variant="outline" className="gap-1"><Archive className="h-3 w-3" /> Archived</Badge>}
              {assignment.is_locked && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Locked</Badge>}
            </DialogTitle>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm" variant="outline" className="gap-2"
                onClick={() => toggleLock.mutate({ assignmentId: assignment.id, locked: !assignment.is_locked })}
                disabled={toggleLock.isPending}
              >
                {assignment.is_locked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {assignment.is_locked ? 'Unlock' : 'Lock'}
              </Button>
              {assignment.is_archived ? (
                <Button
                  size="sm" variant="outline" className="gap-2"
                  onClick={() => unarchiveAssignment.mutate(assignment.id)}
                  disabled={unarchiveAssignment.isPending}
                >
                  <ArchiveRestore className="h-4 w-4" /> Reactivate
                </Button>
              ) : (
                <Button
                  size="sm" variant="outline" className="gap-2"
                  onClick={() => archiveAssignment.mutate(assignment.id)}
                  disabled={archiveAssignment.isPending}
                >
                  <Archive className="h-4 w-4" /> Archive
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${assignment.title}"? This can't be undone from here.`)) {
                    deleteAssignment.mutate(assignment.id, { onSuccess: () => onOpenChange(false) });
                  }
                }}
                disabled={deleteAssignment.isPending}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList>
            <TabsTrigger value="submissions" className="gap-2">
              <Users className="h-4 w-4" />
              Submissions ({submissions.length})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="pre-ca" className="gap-2">
              <ArrowRightCircle className="h-4 w-4" />
              Pre-CA Push
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pre-ca" className="flex-1 overflow-y-auto mt-4 space-y-4">
            <PreCAFieldTargetSelector
              value={(isCBT ? linkedQuiz?.broadsheet_field_id : assignment.broadsheet_field_id) ?? null}
              onChange={(fieldId) => {
                if (isCBT && linkedQuiz) {
                  setQuizBroadsheetField.mutate({ quizId: linkedQuiz.id, broadsheetFieldId: fieldId });
                  return;
                }
                supabase.from('assignments').update({ broadsheet_field_id: fieldId }).eq('id', assignment.id)
                  .then(({ error }) => {
                    if (error) toast.error('Failed to update push target: ' + error.message);
                    else queryClient.invalidateQueries({ queryKey: ['enhanced-assignments'] });
                  });
              }}
              subjectId={assignment.classrooms?.subject_id}
              sourceLabel={assignment.title}
              onConfirmReplace={async () => {
                const result = isCBT && linkedQuiz
                  ? await repushGrades.mutateAsync({ quizId: linkedQuiz.id })
                  : await repushGrades.mutateAsync({ assignmentId: assignment.id });
                toast.success(`Pushed ${result.count} ${isCBT ? 'attempt' : 'submission'}${result.count === 1 ? '' : 's'} to Pre-CA`);
              }}
            />
            <div className="rounded-lg border p-3 bg-muted/30 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Push already-graded scores now</p>
                <p className="text-xs text-muted-foreground">
                  New grades push automatically. Use this only if you set or changed the field above after
                  some {isCBT ? 'attempts were' : 'submissions were'} already graded — they won't re-push on their own.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={(isCBT ? !linkedQuiz?.broadsheet_field_id : !assignment.broadsheet_field_id) || repushGrades.isPending}
                onClick={async () => {
                  try {
                    const result = isCBT && linkedQuiz
                      ? await repushGrades.mutateAsync({ quizId: linkedQuiz.id })
                      : await repushGrades.mutateAsync({ assignmentId: assignment.id });
                    toast.success(`Pushed ${result.count} ${isCBT ? 'attempt' : 'submission'}${result.count === 1 ? '' : 's'} to Pre-CA`);
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to push grades');
                  }
                }}
              >
                {repushGrades.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRightCircle className="h-4 w-4 mr-1" />}
                Push Now
              </Button>
            </div>
          </TabsContent>

           <TabsContent value="submissions" className="flex-1 overflow-hidden mt-4">
            {isCBT ? (
              <div className="h-full overflow-y-auto">
                {attemptsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : quizAttempts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No attempts yet</p>
                  </div>
                ) : (
                  <div className="divide-y border rounded-lg">
                    {quizAttempts.map((attempt: any) => (
                      <div key={attempt.id} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={attempt.students?.avatar_url || ''} />
                            <AvatarFallback className="text-xs">
                              {attempt.students?.first_name?.[0]}{attempt.students?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {attempt.students?.first_name} {attempt.students?.last_name}
                            </p>
                            {attempt.submitted_at && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(attempt.submitted_at), 'MMM d, h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {attempt.total_score !== null && (
                            <Badge variant="outline">
                              {attempt.total_score} / {assignment.total_marks || assignment.points || 100}
                            </Badge>
                          )}
                          <Badge variant={attempt.is_graded ? 'default' : 'secondary'}>
                            {attempt.is_graded ? 'Graded' : 'Awaiting essay grading'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
             <div className="grid grid-cols-3 gap-4 h-full">
               {/* Submissions List */}
               <div className="col-span-1 border rounded-lg overflow-hidden flex flex-col">
                 <div className="p-3 border-b bg-muted/50">
                   <p className="font-medium text-sm">
                     {pendingSubmissions.length} pending • {gradedSubmissions.length} graded
                   </p>
                 </div>
                 <ScrollArea className="flex-1">
                   {isLoading ? (
                     <div className="flex items-center justify-center py-8">
                       <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                     </div>
                   ) : submissions.length === 0 ? (
                     <div className="text-center py-8 text-muted-foreground">
                       <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                       <p>No submissions yet</p>
                     </div>
                   ) : (
                     <div className="divide-y">
                       {submissions.map((submission) => (
                         <button
                           key={submission.id}
                           onClick={() => handleSelectSubmission(submission)}
                           className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
                             selectedSubmission?.id === submission.id ? 'bg-muted' : ''
                           }`}
                         >
                           <div className="flex items-center gap-3">
                             <Avatar className="h-8 w-8">
                               <AvatarImage src={submission.students?.avatar_url || ''} />
                               <AvatarFallback className="text-xs">
                                 {getStudentInitials(submission.students)}
                               </AvatarFallback>
                             </Avatar>
                             <div className="flex-1 min-w-0">
                               <p className="font-medium text-sm truncate">
                                 {submission.students?.first_name} {submission.students?.last_name}
                               </p>
                               <p className="text-xs text-muted-foreground">
                                 {format(new Date(submission.submitted_at), 'MMM d, h:mm a')}
                               </p>
                             </div>
                             <div className="flex items-center gap-1">
                               {submission.is_late && (
                                 <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                                   Late
                                 </Badge>
                               )}
                               {submission.status === 'graded' ? (
                                 <Badge className="bg-success/10 text-success border-success/30 text-xs">
                                   {submission.grade}/{totalMarks}
                                 </Badge>
                               ) : (
                                 <Badge variant="outline" className="text-xs">Pending</Badge>
                               )}
                             </div>
                           </div>
                         </button>
                       ))}
                     </div>
                   )}
                 </ScrollArea>
               </div>
 
               {/* Grading Panel */}
               <div className="col-span-2 border rounded-lg overflow-hidden flex flex-col">
                 {selectedSubmission ? (
                   <>
                     <div className="p-4 border-b bg-muted/50 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <Avatar>
                           <AvatarImage src={selectedSubmission.students?.avatar_url || ''} />
                           <AvatarFallback>{getStudentInitials(selectedSubmission.students)}</AvatarFallback>
                         </Avatar>
                         <div>
                           <p className="font-medium">
                             {selectedSubmission.students?.first_name} {selectedSubmission.students?.last_name}
                           </p>
                           <p className="text-sm text-muted-foreground">
                             {selectedSubmission.students?.admission_number}
                           </p>
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <Button
                           variant="outline"
                           size="icon"
                           onClick={() => navigateSubmission('prev')}
                           disabled={submissions.findIndex(s => s.id === selectedSubmission.id) === 0}
                          title="Previous submission">
                           <ChevronLeft className="h-4 w-4" />
                         </Button>
                         <span className="text-sm text-muted-foreground">
                           {submissions.findIndex(s => s.id === selectedSubmission.id) + 1} of {submissions.length}
                         </span>
                         <Button
                           variant="outline"
                           size="icon"
                           onClick={() => navigateSubmission('next')}
                           disabled={submissions.findIndex(s => s.id === selectedSubmission.id) === submissions.length - 1}
                          title="Next submission">
                           <ChevronRight className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
 
                     <ScrollArea className="flex-1 p-4">
                       <div className="space-y-4">
                         {/* Submission Info */}
                         <div className="flex items-center gap-4 text-sm text-muted-foreground">
                           <div className="flex items-center gap-1">
                             <Clock className="h-4 w-4" />
                             Submitted: {format(new Date(selectedSubmission.submitted_at), 'PPp')}
                           </div>
                           {selectedSubmission.is_late && (
                             <Badge variant="outline" className="text-warning border-warning/30">
                               <AlertCircle className="h-3 w-3 mr-1" />
                               Late Submission
                             </Badge>
                           )}
                         </div>
 
                         {/* Student's Work */}
                         <Card>
                           <CardHeader className="py-3">
                             <CardTitle className="text-sm">Student's Work</CardTitle>
                           </CardHeader>
                           <CardContent>
                             {selectedSubmission.content || selectedSubmission.submitted_content ? (
                               <div className="prose prose-sm max-w-none">
                                 <pre className="whitespace-pre-wrap bg-muted p-4 rounded-lg text-sm">
                                   {selectedSubmission.content || selectedSubmission.submitted_content}
                                 </pre>
                               </div>
                             ) : (
                               <p className="text-muted-foreground text-sm">No typed content</p>
                             )}
 
                             {selectedSubmission.attachments && selectedSubmission.attachments.length > 0 && (
                               <div className="mt-4">
                                 <p className="text-sm font-medium mb-2">Attachments:</p>
                                 <div className="flex flex-wrap gap-2">
                                   {selectedSubmission.attachments.map((att) => (
                                     <a
                                       key={att.id}
                                       href={att.url}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm hover:bg-muted/80"
                                     >
                                       <FileText className="h-4 w-4" />
                                       {att.name}
                                       <ExternalLink className="h-3 w-3" />
                                     </a>
                                   ))}
                                 </div>
                               </div>
                             )}
                           </CardContent>
                         </Card>
 
                         {/* Grading */}
                         <Card>
                           <CardHeader className="py-3">
                             <CardTitle className="text-sm">Grade & Feedback</CardTitle>
                           </CardHeader>
                           <CardContent className="space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                               <div>
                                 <Label htmlFor="grade">Score (out of {totalMarks})</Label>
                                 <Input
                                   id="grade"
                                   type="number"
                                   min={0}
                                   max={totalMarks}
                                   value={grade}
                                   onChange={(e) => setGrade(e.target.value)}
                                   placeholder="Enter score"
                                 />
                               </div>
                               <div className="flex items-end">
                                 {grade && (
                                   <div className="text-2xl font-bold text-foreground">
                                     {((parseFloat(grade) / totalMarks) * 100).toFixed(0)}%
                                   </div>
                                 )}
                               </div>
                             </div>
 
                             <div>
                               <Label htmlFor="feedback">Feedback (optional)</Label>
                               <Textarea
                                 id="feedback"
                                 value={feedback}
                                 onChange={(e) => setFeedback(e.target.value)}
                                 placeholder="Provide feedback to the student..."
                                 rows={3}
                               />
                             </div>
                           </CardContent>
                         </Card>
                       </div>
                     </ScrollArea>
 
                     <div className="p-4 border-t flex justify-end gap-2">
                       <Button
                         onClick={handleGrade}
                         disabled={!grade || gradeSubmission.isPending}
                       >
                         {gradeSubmission.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                         <CheckCircle2 className="h-4 w-4 mr-2" />
                         Save & Next
                       </Button>
                     </div>
                   </>
                 ) : (
                   <div className="flex-1 flex items-center justify-center text-muted-foreground">
                     <div className="text-center">
                       <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                       <p>Select a submission to grade</p>
                     </div>
                   </div>
                 )}
               </div>
             </div>
            )}
           </TabsContent>
 
           <TabsContent value="analytics" className="flex-1 overflow-auto mt-4">
             {analytics ? (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <Card>
                   <CardContent className="pt-6">
                     <div className="text-2xl font-bold">{analytics.totalSubmissions}</div>
                     <p className="text-sm text-muted-foreground">Total Submissions</p>
                   </CardContent>
                 </Card>
                 <Card>
                   <CardContent className="pt-6">
                     <div className="text-2xl font-bold">{analytics.averageScore.toFixed(1)}</div>
                     <p className="text-sm text-muted-foreground">Average Score</p>
                   </CardContent>
                 </Card>
                 <Card>
                   <CardContent className="pt-6">
                     <div className="text-2xl font-bold text-success">{analytics.highestScore}</div>
                     <p className="text-sm text-muted-foreground">Highest Score</p>
                   </CardContent>
                 </Card>
                 <Card>
                   <CardContent className="pt-6">
                     <div className="text-2xl font-bold text-destructive">{analytics.lowestScore}</div>
                     <p className="text-sm text-muted-foreground">Lowest Score</p>
                   </CardContent>
                 </Card>
                 <Card className="col-span-2">
                   <CardHeader>
                     <CardTitle className="text-sm">Score Distribution</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <span className="text-sm">Excellent (90+)</span>
                         <Badge variant="secondary">{analytics.scoreDistribution.excellent}</Badge>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm">Good (70-89)</span>
                         <Badge variant="secondary">{analytics.scoreDistribution.good}</Badge>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm">Average (50-69)</span>
                         <Badge variant="secondary">{analytics.scoreDistribution.average}</Badge>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm">Below Average (&lt;50)</span>
                         <Badge variant="secondary">{analytics.scoreDistribution.below}</Badge>
                       </div>
                     </div>
                   </CardContent>
                 </Card>
                 <Card className="col-span-2">
                   <CardHeader>
                     <CardTitle className="text-sm">Submission Stats</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <span className="text-sm">Graded</span>
                         <Badge className="bg-success/10 text-success">{analytics.gradedCount}</Badge>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm">Pending</span>
                         <Badge variant="outline">{analytics.pendingCount}</Badge>
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-sm">Late Submissions</span>
                         <Badge variant="outline" className="text-warning border-warning/30">{analytics.lateCount}</Badge>
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               </div>
             ) : (
               <div className="text-center py-12 text-muted-foreground">
                 <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                 <p>No analytics data available yet</p>
               </div>
             )}
           </TabsContent>
         </Tabs>
 
         <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Close
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }
 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { useAuth } from '@/contexts/AuthContext';
 import {
   useEnhancedAssignments, useUnarchiveEnhancedAssignment, useDeleteEnhancedAssignment, EnhancedAssignment,
   useBulkArchiveEnhancedAssignments, useBulkDeleteEnhancedAssignments,
 } from '@/hooks/useEnhancedAssignments';
 import { useMyClassrooms } from '@/hooks/useClassroomData';
 import { CreateAssignmentDialog } from '@/components/assignments/CreateAssignmentDialog';
 import { EditAssignmentDialog } from '@/components/assignments/EditAssignmentDialog';
 import { AssignmentGradingDialog } from '@/components/assignments/AssignmentGradingDialog';
 import { AssignmentCard } from '@/components/classroom/AssignmentCard';
 import { format } from 'date-fns';
 import {
   Plus,
   Clock,
   CheckCircle2,
   AlertCircle,
   FileText,
   Users,
   Calendar,
   BarChart3,
   Edit,
   Eye,
   Loader2,
   Archive,
   ArchiveRestore,
   Trash2,
   CheckSquare,
   X,
 } from 'lucide-react';
 
 export default function Assignments() {
   const { user } = useAuth();
   const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';
   const [activeTab, setActiveTab] = useState('active');
   const [createDialogOpen, setCreateDialogOpen] = useState(false);
   const [gradingAssignment, setGradingAssignment] = useState<EnhancedAssignment | null>(null);
   const [editingAssignment, setEditingAssignment] = useState<EnhancedAssignment | null>(null);
   const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
 
   const { data: classrooms = [] } = useMyClassrooms();
   const { data: assignments = [], isLoading } = useEnhancedAssignments(
     selectedClassroom !== 'all' ? selectedClassroom : undefined
   );
   const unarchiveAssignment = useUnarchiveEnhancedAssignment();
   const deleteAssignment = useDeleteEnhancedAssignment();

   // Bulk-select — mirrors the Quizzes page's pattern: a toggled selection
   // mode with a sticky action bar, batched Archive/Delete requests.
   const [selectMode, setSelectMode] = useState(false);
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const bulkArchive = useBulkArchiveEnhancedAssignments();
   const bulkDelete = useBulkDeleteEnhancedAssignments();

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
     if (!confirm(`Delete ${selectedIds.size} selected assignment${selectedIds.size === 1 ? '' : 's'}? This can't be undone from here.`)) return;
     bulkDelete.mutate(Array.from(selectedIds), { onSuccess: exitSelectMode });
   };

 
   const activeAssignments = assignments.filter(a => a.status === 'published' && !a.is_archived);
   const draftAssignments = assignments.filter(a => a.status === 'draft' && !a.is_archived);
   const archivedAssignments = assignments.filter(a => a.is_archived);
   const toGradeAssignments = activeAssignments.filter(a => 
     (a._count?.submissions || 0) > 0 && 
     a.submissions?.some(s => s.status !== 'graded')
   );
 
   const getAssignmentTypeBadge = (type: string | null) => {
     const colors: Record<string, string> = {
       holiday: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
       project: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
       weekend: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
       daily: 'bg-green-500/10 text-green-500 border-green-500/20',
       weekly: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
       mid_term: 'bg-red-500/10 text-red-500 border-red-500/20',
       practical: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
     };
     return colors[type || ''] || 'bg-muted text-muted-foreground';
   };
 
   const renderAssignmentCard = (assignment: EnhancedAssignment) => {
     if (!isTeacher) {
       return <AssignmentCard key={assignment.id} assignment={assignment} />;
     }
 
     const submissionCount = assignment._count?.submissions || 0;
     const totalStudents = assignment._count?.totalStudents || 0;
     const gradedCount = assignment.submissions?.filter(s => s.status === 'graded').length || 0;
     const isOverdue = assignment.due_date && new Date(assignment.due_date) < new Date();
 
     return (
       <Card
         key={assignment.id}
         className={`hover:shadow-md transition-shadow ${selectMode && selectedIds.has(assignment.id) ? 'ring-2 ring-primary' : ''}`}
         onClick={selectMode ? () => toggleSelected(assignment.id) : undefined}
       >
         <CardContent className="p-4">
           <div className="flex items-start justify-between gap-2 mb-3">
             <div className="flex items-start gap-2 flex-1 min-w-0">
               {selectMode && (
                 <Checkbox
                   checked={selectedIds.has(assignment.id)}
                   onCheckedChange={() => toggleSelected(assignment.id)}
                   onClick={(e) => e.stopPropagation()}
                   className="mt-1"
                 />
               )}
               <div className="flex-1 min-w-0">
                 <h4 className="font-semibold text-foreground truncate">{assignment.title}</h4>
                 <p className="text-sm text-muted-foreground truncate">
                   {assignment.classrooms?.name} {assignment.topic ? `• ${assignment.topic}` : ''}
                 </p>
               </div>
             </div>
             <Badge className={getAssignmentTypeBadge(assignment.assignment_type)}>
               {assignment.assignment_type?.replace('_', ' ') || 'Assignment'}
             </Badge>
           </div>
 
           {assignment.instructions && (
             <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
               {assignment.instructions}
             </p>
           )}
 
           <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
             {assignment.due_date && (
               <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : ''}`}>
                 <Calendar className="h-4 w-4" />
                 {format(new Date(assignment.due_date), 'MMM d, yyyy')}
               </div>
             )}
             <div className="flex items-center gap-1">
               <Users className="h-4 w-4" />
               {submissionCount}/{totalStudents}
             </div>
             {assignment.total_marks && (
               <Badge variant="outline">{assignment.total_marks} pts</Badge>
             )}
           </div>
 
           {isTeacher && !selectMode && (
             <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
               <Button
                 variant="outline"
                 size="sm"
                 className="flex-1 gap-1"
                 onClick={() => setGradingAssignment(assignment)}
               >
                 <BarChart3 className="h-4 w-4" />
                 Grade ({gradedCount}/{submissionCount})
               </Button>
               <Button variant="outline" size="sm" title="Edit assignment" onClick={() => setEditingAssignment(assignment)}>
                 <Edit className="h-4 w-4" />
               </Button>
             </div>
           )}
         </CardContent>
       </Card>
     );
   };

   const renderArchivedAssignmentCard = (assignment: EnhancedAssignment) => (
     <Card key={assignment.id} className="hover:shadow-md transition-shadow">
       <CardContent className="p-4">
         <div className="flex items-start justify-between gap-2 mb-3">
           <div className="flex-1 min-w-0">
             <h4 className="font-semibold text-foreground truncate">{assignment.title}</h4>
             <p className="text-sm text-muted-foreground truncate">
               {assignment.classrooms?.name} {assignment.topic ? `• ${assignment.topic}` : ''}
             </p>
           </div>
           <Badge variant="outline" className="gap-1">
             <Archive className="h-3 w-3" /> Archived
           </Badge>
         </div>
         <div className="flex gap-2">
           <Button
             variant="outline"
             size="sm"
             className="flex-1 gap-1"
             onClick={() => setGradingAssignment(assignment)}
           >
             <Eye className="h-4 w-4" />
             View
           </Button>
           <Button
             variant="outline"
             size="sm"
             className="flex-1 gap-1"
             onClick={() => unarchiveAssignment.mutate(assignment.id)}
             disabled={unarchiveAssignment.isPending}
           >
             <ArchiveRestore className="h-4 w-4" />
             Reactivate
           </Button>
           <Button
             variant="outline"
             size="sm"
             className="text-destructive hover:text-destructive"
             onClick={() => {
               if (confirm(`Delete "${assignment.title}"? This can't be undone from here.`)) {
                 deleteAssignment.mutate(assignment.id);
               }
             }}
             disabled={deleteAssignment.isPending}
           >
             <Trash2 className="h-4 w-4" />
           </Button>
         </div>
       </CardContent>
     </Card>
   );
 
   return (
     <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
         <div>
           <h1 className="text-3xl font-bold text-foreground font-display">Assignments</h1>
           <p className="text-muted-foreground mt-1">
             {isTeacher ? 'Create, manage and grade student assignments' : 'View and submit your assignments'}
           </p>
         </div>
         <div className="flex items-center gap-3">
           {classrooms.length > 0 && (
             <Select value={selectedClassroom} onValueChange={setSelectedClassroom}>
               <SelectTrigger className="w-[200px]">
                 <SelectValue placeholder="All Classrooms" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Classrooms</SelectItem>
                 {classrooms.map((c: any) => (
                   <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           )}
           {isTeacher && (
             <Button
               variant="outline"
               className="gap-2"
               onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
             >
               {selectMode ? <X size={18} /> : <CheckSquare size={18} />}
               {selectMode ? 'Cancel' : 'Select'}
             </Button>
           )}
           {isTeacher && (
             <Button className="btn-accent gap-2" onClick={() => setCreateDialogOpen(true)}>
               <Plus size={18} />
               Create Assignment
             </Button>
           )}
         </div>
       </div>

       {/* Bulk-select action bar — mirrors the Quizzes page's; a single
           batched Archive/Delete request for the whole checked set. */}
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
 
       {/* Stats */}
       <div className="grid gap-4 md:grid-cols-4">
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="rounded-xl bg-secondary/10 p-3 text-secondary">
               <FileText size={24} />
             </div>
             <div>
               <p className="text-2xl font-bold text-foreground">{assignments.length}</p>
               <p className="text-sm text-muted-foreground">Total</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="rounded-xl bg-success/10 p-3 text-success">
               <CheckCircle2 size={24} />
             </div>
             <div>
               <p className="text-2xl font-bold text-foreground">{activeAssignments.length}</p>
               <p className="text-sm text-muted-foreground">Active</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="rounded-xl bg-warning/10 p-3 text-warning">
               <Clock size={24} />
             </div>
             <div>
               <p className="text-2xl font-bold text-foreground">{toGradeAssignments.length}</p>
               <p className="text-sm text-muted-foreground">To Grade</p>
             </div>
           </CardContent>
         </Card>
         <Card>
           <CardContent className="p-4 flex items-center gap-4">
             <div className="rounded-xl bg-muted p-3 text-muted-foreground">
               <AlertCircle size={24} />
             </div>
             <div>
               <p className="text-2xl font-bold text-foreground">{draftAssignments.length}</p>
               <p className="text-sm text-muted-foreground">Drafts</p>
             </div>
           </CardContent>
         </Card>
       </div>
 
       <Tabs value={activeTab} onValueChange={setActiveTab}>
         <TabsList>
           <TabsTrigger value="active" className="gap-2">
             <CheckCircle2 size={16} />
             Active ({activeAssignments.length})
           </TabsTrigger>
           {isTeacher && (
             <>
               <TabsTrigger value="to-grade" className="gap-2">
                 <BarChart3 size={16} />
                 To Grade ({toGradeAssignments.length})
               </TabsTrigger>
               <TabsTrigger value="drafts" className="gap-2">
                 <FileText size={16} />
                 Drafts ({draftAssignments.length})
               </TabsTrigger>
               <TabsTrigger value="archived" className="gap-2">
                 <Archive size={16} />
                 Archived ({archivedAssignments.length})
               </TabsTrigger>
             </>
           )}
         </TabsList>
 
         <TabsContent value="active" className="mt-6">
           {isLoading ? (
             <div className="flex items-center justify-center py-12">
               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
           ) : activeAssignments.length === 0 ? (
             <Card>
               <CardContent className="py-12 text-center">
                 <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                 <h3 className="mt-4 text-lg font-semibold">No active assignments</h3>
                 <p className="text-muted-foreground mt-2">
                   {isTeacher ? 'Create a new assignment to get started' : 'Check back later'}
                 </p>
               </CardContent>
             </Card>
           ) : (
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
               {activeAssignments.map(renderAssignmentCard)}
             </div>
           )}
         </TabsContent>
 
         {isTeacher && (
           <>
             <TabsContent value="to-grade" className="mt-6">
               {toGradeAssignments.length === 0 ? (
                 <Card>
                   <CardContent className="py-12 text-center">
                     <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                     <h3 className="mt-4 text-lg font-semibold">All caught up!</h3>
                     <p className="text-muted-foreground mt-2">No submissions pending grading</p>
                   </CardContent>
                 </Card>
               ) : (
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                   {toGradeAssignments.map(renderAssignmentCard)}
                 </div>
               )}
             </TabsContent>
 
             <TabsContent value="drafts" className="mt-6">
               {draftAssignments.length === 0 ? (
                 <Card>
                   <CardContent className="py-12 text-center">
                     <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                     <h3 className="mt-4 text-lg font-semibold">No drafts</h3>
                     <p className="text-muted-foreground mt-2">All assignments have been published</p>
                   </CardContent>
                 </Card>
               ) : (
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                   {draftAssignments.map(renderAssignmentCard)}
                 </div>
               )}
             </TabsContent>

             <TabsContent value="archived" className="mt-6">
               {archivedAssignments.length === 0 ? (
                 <Card>
                   <CardContent className="py-12 text-center">
                     <Archive className="mx-auto h-12 w-12 text-muted-foreground/50" />
                     <h3 className="mt-4 text-lg font-semibold">No archived assignments</h3>
                     <p className="text-muted-foreground mt-2">
                       Assignments you archive will appear here.
                     </p>
                   </CardContent>
                 </Card>
               ) : (
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                   {archivedAssignments.map(renderArchivedAssignmentCard)}
                 </div>
               )}
             </TabsContent>
           </>
         )}
       </Tabs>
 
       {/* Dialogs */}
       <CreateAssignmentDialog
         open={createDialogOpen}
         onOpenChange={setCreateDialogOpen}
         defaultClassroomId={selectedClassroom !== 'all' ? selectedClassroom : undefined}
       />
 
       {gradingAssignment && (
         <AssignmentGradingDialog
           open={!!gradingAssignment}
           onOpenChange={(open) => !open && setGradingAssignment(null)}
           assignment={gradingAssignment}
         />
       )}

       <EditAssignmentDialog
         assignment={editingAssignment}
         open={!!editingAssignment}
         onOpenChange={(open) => !open && setEditingAssignment(null)}
       />
     </div>
   );
 }

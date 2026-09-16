 import { useState, useRef, useEffect } from 'react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Switch } from '@/components/ui/switch';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateEnhancedAssignment, CreateAssignmentInput } from '@/hooks/useEnhancedAssignments';
import { useMyClassrooms } from '@/hooks/useClassroomData';
import { supabase } from '@/integrations/supabase/client';
import { PreCAFieldTargetSelector } from '@/components/results/PreCAFieldTargetSelector';
import { QuestionListEditor } from '@/components/quiz/QuestionListEditor';
import { useCreateEnhancedQuiz, useAddQuizQuestions, QuizQuestion } from '@/hooks/useEnhancedQuizzes';
 import { toast } from 'sonner';
 import {
   FileText,
   Upload,
   Link,
   Calendar,
   Clock,
   Loader2,
   Paperclip,
   X,
   Settings,
   Info,
 } from 'lucide-react';
 
 interface CreateAssignmentDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   defaultClassroomId?: string;
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
 
 const CONTENT_TYPES = [
   { value: 'typed', label: 'Typed Response', icon: FileText, description: 'Students type their answers' },
   { value: 'upload', label: 'File Upload', icon: Upload, description: 'Students upload files' },
   { value: 'cbt', label: 'CBT (Quiz)', icon: Link, description: 'Computer-based test format' },
 ];
 
 const FILE_TYPES = [
   { value: 'pdf', label: 'PDF' },
   { value: 'doc', label: 'DOC' },
   { value: 'docx', label: 'DOCX' },
   { value: 'jpg', label: 'JPG' },
   { value: 'png', label: 'PNG' },
   { value: 'link', label: 'Links' },
 ];
 
 export function CreateAssignmentDialog({ open, onOpenChange, defaultClassroomId }: CreateAssignmentDialogProps) {
   const [activeTab, setActiveTab] = useState('basic');
   const [title, setTitle] = useState('');
   const [instructions, setInstructions] = useState('');
   const [topic, setTopic] = useState('');
   const [assignmentType, setAssignmentType] = useState('weekly');
   const [contentType, setContentType] = useState('typed');
   const [allowedFileTypes, setAllowedFileTypes] = useState<string[]>(['pdf', 'doc', 'docx', 'jpg', 'png']);
   const [totalMarks, setTotalMarks] = useState(100);
   const [classroomId, setClassroomId] = useState(defaultClassroomId || '');

   // Same class-filter-inheritance bug as EnhancedCreateQuizDialog: this
   // dialog stays mounted between opens, so classroomId was only ever
   // seeded from defaultClassroomId on first mount. Re-sync every time
   // the dialog opens so it reflects the Assignments page's current
   // classroom filter.
   useEffect(() => {
     if (open) {
       setClassroomId(defaultClassroomId || '');
     }
   }, [open, defaultClassroomId]);

   const [dueDate, setDueDate] = useState('');
   const [dueTime, setDueTime] = useState('23:59');
   const [allowLateSubmission, setAllowLateSubmission] = useState(true);
   const [latePenalty, setLatePenalty] = useState(0);
   const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [broadsheetFieldId, setBroadsheetFieldId] = useState<string | null>(null);
  const [cbtQuestions, setCbtQuestions] = useState<QuizQuestion[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: classrooms = [] } = useMyClassrooms();
  const createAssignment = useCreateEnhancedAssignment();
  const createQuiz = useCreateEnhancedQuiz();
  const addQuizQuestions = useAddQuizQuestions();
  const selectedClassroom = classrooms.find((c: any) => c.id === classroomId);
 
   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const files = e.target.files;
     if (!files || files.length === 0) return;
     
     setIsUploading(true);
     try {
       for (const file of Array.from(files)) {
         const fileExt = file.name.split('.').pop();
         const fileName = `assignments/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
         
         const { error: uploadError } = await supabase.storage
           .from('classroom-materials')
           .upload(fileName, file);
         
         if (uploadError) throw uploadError;
         
         const { data: urlData } = supabase.storage
           .from('classroom-materials')
           .getPublicUrl(fileName);
         
         setAttachments(prev => [...prev, {
           name: file.name,
           url: urlData.publicUrl,
           type: 'file',
         }]);
       }
       toast.success('File(s) uploaded');
     } catch (error: any) {
       toast.error('Failed to upload: ' + error.message);
     } finally {
       setIsUploading(false);
       if (fileInputRef.current) fileInputRef.current.value = '';
     }
   };
 
  const handleCreate = async (publishNow: boolean) => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!classroomId) {
      toast.error('Please select a classroom');
      return;
    }
    if (contentType === 'cbt' && cbtQuestions.length === 0) {
      toast.error('Add at least one question for this CBT assignment');
      return;
    }

    const calculatedCbtMarks = cbtQuestions.reduce((sum, q) => sum + q.points, 0);
    const effectiveTotalMarks = contentType === 'cbt' && calculatedCbtMarks > 0 ? calculatedCbtMarks : totalMarks;

    const input: CreateAssignmentInput = {
      title: title.trim(),
      instructions: instructions.trim() || undefined,
      topic: topic.trim() || undefined,
      assignment_type: assignmentType,
      content_type: contentType,
      allowed_file_types: contentType === 'upload' ? allowedFileTypes : undefined,
      total_marks: effectiveTotalMarks,
      classroom_id: classroomId,
      due_date: dueDate || undefined,
      due_time: dueTime || undefined,
      allow_late_submission: allowLateSubmission,
      late_penalty_percent: allowLateSubmission ? latePenalty : 0,
      status: publishNow ? 'published' : 'draft',
      attachments: attachments.length > 0 ? attachments : undefined,
      broadsheet_field_id: broadsheetFieldId,
    };

    const assignment = await createAssignment.mutateAsync(input);

    // CBT content lives in a real quiz row (quiz_questions, quiz_attempts,
    // auto-grading, and this session's quiz->Pre-CA push fix all already
    // exist there) — assignment_id links it back to this assignment
    // rather than duplicating a whole parallel question-storage system.
    if (contentType === 'cbt' && assignment) {
      const quiz = await createQuiz.mutateAsync({
        title: title.trim(),
        description: instructions.trim() || undefined,
        quiz_type: 'practice',
        content_type: 'cbt',
        total_marks: effectiveTotalMarks,
        total_points: effectiveTotalMarks,
        classroom_id: classroomId,
        is_active: publishNow,
        assignment_id: assignment.id,
        // The auto-push trigger (propagate_quiz_attempt_to_broadsheet)
        // reads broadsheet_field_id from the QUIZ row, not the assignment
        // — has to be set here too, or the push target the teacher picked
        // above silently never does anything once students start taking it.
        broadsheet_field_id: broadsheetFieldId,
      });
      await addQuizQuestions.mutateAsync({ quizId: quiz.id, questions: cbtQuestions });
    }

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setTitle('');
    setInstructions('');
    setTopic('');
    setAssignmentType('weekly');
    setContentType('typed');
    setAllowedFileTypes(['pdf', 'doc', 'docx', 'jpg', 'png']);
    setTotalMarks(100);
    setDueDate('');
    setDueTime('23:59');
    setAllowLateSubmission(true);
    setLatePenalty(0);
    setStatus('draft');
    setAttachments([]);
    setActiveTab('basic');
    setBroadsheetFieldId(null);
    setCbtQuestions([]);
  };
 
   const toggleFileType = (type: string) => {
     setAllowedFileTypes(prev =>
       prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
     );
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <FileText className="h-5 w-5" />
             Create New Assignment
           </DialogTitle>
         </DialogHeader>
 
         <Tabs value={activeTab} onValueChange={setActiveTab}>
           <TabsList className="grid w-full grid-cols-3">
             <TabsTrigger value="basic">Basic Info</TabsTrigger>
             <TabsTrigger value="content">Content</TabsTrigger>
             <TabsTrigger value="settings">Settings</TabsTrigger>
           </TabsList>
 
           <TabsContent value="basic" className="space-y-4 py-4">
             <div>
               <Label htmlFor="title">Assignment Title *</Label>
               <Input
                 id="title"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g., Math Homework 3"
               />
             </div>
 
             <div>
               <Label htmlFor="instructions">Instructions / Description</Label>
               <Textarea
                 id="instructions"
                 value={instructions}
                 onChange={(e) => setInstructions(e.target.value)}
                 placeholder="Describe what students need to do..."
                 rows={4}
               />
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label htmlFor="type">Assignment Type *</Label>
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
                 <Label htmlFor="topic">Topic (optional)</Label>
                 <Input
                   id="topic"
                   value={topic}
                   onChange={(e) => setTopic(e.target.value)}
                   placeholder="e.g., Algebra"
                 />
               </div>
             </div>
 
            <div>
              <Label>Classroom *</Label>
              <Select value={classroomId} onValueChange={setClassroomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a classroom" />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.subjects?.name ? `- ${c.subjects.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
 
           <TabsContent value="content" className="space-y-4 py-4">
             <div>
               <Label className="mb-3 block">Submission Type *</Label>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                 {CONTENT_TYPES.map((type) => (
                   <button
                     key={type.value}
                     type="button"
                     onClick={() => setContentType(type.value)}
                     className={`p-4 rounded-lg border-2 text-left transition-all ${
                       contentType === type.value
                         ? 'border-primary bg-primary/5'
                         : 'border-border hover:border-muted-foreground/50'
                     }`}
                   >
                     <type.icon className={`h-6 w-6 mb-2 ${contentType === type.value ? 'text-primary' : 'text-muted-foreground'}`} />
                     <p className="font-medium text-sm">{type.label}</p>
                     <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                   </button>
                 ))}
               </div>
             </div>
 
             {contentType === 'upload' && (
               <div>
                 <Label className="mb-3 block">Allowed File Types</Label>
                 <div className="flex flex-wrap gap-2">
                   {FILE_TYPES.map((type) => (
                     <button
                       key={type.value}
                       type="button"
                       onClick={() => toggleFileType(type.value)}
                       className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                         allowedFileTypes.includes(type.value)
                           ? 'bg-primary text-primary-foreground'
                           : 'bg-muted text-muted-foreground hover:bg-muted/80'
                       }`}
                     >
                       {type.label}
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {contentType === 'cbt' && (
               <div>
                 <Label className="mb-3 block">Questions *</Label>
                 <p className="text-xs text-muted-foreground mb-3">
                   Students take this like a quiz — auto-graded for multiple-choice and true/false, scored
                   automatically the moment they submit.
                 </p>
                 <QuestionListEditor
                   questions={cbtQuestions}
                   onChange={setCbtQuestions}
                   emptyHint="No questions yet — add at least one to publish this CBT assignment"
                 />
               </div>
             )}
 
             <div>
               <Label htmlFor="marks">Total Marks</Label>
               {contentType === 'cbt' ? (
                 <div className="h-10 flex items-center px-3 bg-muted rounded-md">
                   <span className="font-medium">
                     {cbtQuestions.reduce((sum, q) => sum + q.points, 0) || totalMarks}
                   </span>
                   <span className="text-muted-foreground ml-1 text-sm">pts (sum of question points)</span>
                 </div>
               ) : (
                 <Input
                   id="marks"
                   type="number"
                   min={1}
                   value={totalMarks}
                   onChange={(e) => setTotalMarks(parseInt(e.target.value) || 100)}
                 />
               )}
             </div>

             <PreCAFieldTargetSelector
               value={broadsheetFieldId}
               onChange={setBroadsheetFieldId}
               subjectId={selectedClassroom?.subject_id}
               sourceLabel={title.trim() || 'this assignment'}
             />
 
             <div>
               <Label className="mb-2 block">Attachments / Resources</Label>
               <input
                 ref={fileInputRef}
                 type="file"
                 multiple
                 className="hidden"
                 onChange={handleFileUpload}
               />
               <Button
                 variant="outline"
                 className="w-full gap-2"
                 onClick={() => fileInputRef.current?.click()}
                 disabled={isUploading}
               >
                 {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                 Upload Files
               </Button>
               {attachments.length > 0 && (
                 <div className="flex flex-wrap gap-2 mt-3">
                   {attachments.map((att, i) => (
                     <Badge key={i} variant="secondary" className="gap-1">
                       <Paperclip className="h-3 w-3" />
                       {att.name}
                       <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                         <X className="h-3 w-3" />
                       </button>
                     </Badge>
                   ))}
                 </div>
               )}
             </div>
           </TabsContent>
 
           <TabsContent value="settings" className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label htmlFor="due-date">Due Date</Label>
                 <div className="flex items-center gap-2 mt-1">
                   <Calendar className="h-4 w-4 text-muted-foreground" />
                   <Input
                     id="due-date"
                     type="date"
                     value={dueDate}
                     onChange={(e) => setDueDate(e.target.value)}
                   />
                 </div>
               </div>
               <div>
                 <Label htmlFor="due-time">Due Time</Label>
                 <div className="flex items-center gap-2 mt-1">
                   <Clock className="h-4 w-4 text-muted-foreground" />
                   <Input
                     id="due-time"
                     type="time"
                     value={dueTime}
                     onChange={(e) => setDueTime(e.target.value)}
                   />
                 </div>
               </div>
             </div>
 
             <div className="flex items-center justify-between p-4 rounded-lg border">
               <div className="flex items-center gap-3">
                 <Settings className="h-5 w-5 text-muted-foreground" />
                 <div>
                   <p className="font-medium">Allow Late Submissions</p>
                   <p className="text-sm text-muted-foreground">Students can submit after the due date</p>
                 </div>
               </div>
               <Switch
                 checked={allowLateSubmission}
                 onCheckedChange={setAllowLateSubmission}
               />
             </div>
 
             {allowLateSubmission && (
               <div>
                 <Label htmlFor="penalty">Late Submission Penalty (%)</Label>
                 <Input
                   id="penalty"
                   type="number"
                   min={0}
                   max={100}
                   value={latePenalty}
                   onChange={(e) => setLatePenalty(parseInt(e.target.value) || 0)}
                 />
                 <p className="text-xs text-muted-foreground mt-1">
                   Deduct this percentage from late submissions
                 </p>
               </div>
             )}
 
             <div className="p-4 rounded-lg bg-muted/50 flex items-start gap-3">
               <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
               <div className="text-sm text-muted-foreground">
                 <p className="font-medium text-foreground">Publishing Info</p>
                 <p>Save as draft to continue editing later, or publish now to make it visible to students.</p>
               </div>
             </div>
           </TabsContent>
         </Tabs>
 
         <DialogFooter className="gap-2">
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Cancel
           </Button>
           <Button
             variant="secondary"
             onClick={() => handleCreate(false)}
             disabled={createAssignment.isPending}
           >
             {createAssignment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
             Save as Draft
           </Button>
           <Button
             onClick={() => handleCreate(true)}
             disabled={createAssignment.isPending}
           >
             {createAssignment.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
             Publish Now
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }
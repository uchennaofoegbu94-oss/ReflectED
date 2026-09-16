 import { useState, useEffect } from 'react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Switch } from '@/components/ui/switch';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateEnhancedQuiz, useAddQuizQuestions, CreateQuizInput, QuizQuestion } from '@/hooks/useEnhancedQuizzes';
import { useMyClassrooms } from '@/hooks/useClassroomData';
import { EditDraftQuestionDialog } from './EditDraftQuestionDialog';
import { PreCAFieldTargetSelector } from '@/components/results/PreCAFieldTargetSelector';
import { toast } from 'sonner';
 import {
   FileQuestion,
   Clock,
   Calendar,
   Settings,
   Plus,
   Trash2,
   CheckCircle2,
   Circle,
   GripVertical,
   Loader2,
   Info,
   Link as LinkIcon,
   Import,
   Upload,
   Eye,
   Pencil,
 } from 'lucide-react';
 
 interface EnhancedCreateQuizDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   defaultClassroomId?: string;
 }
 
const QUIZ_TYPES = [
  { value: 'resumption', label: 'Resumption Test' },
  { value: 'weekly_test', label: 'Weekly Test' },
  { value: 'mid_term', label: 'Mid-Term Exam' },
  { value: 'end_of_term_exam', label: 'End of Term Exam' },
  { value: 'practice', label: 'Practice Quiz' },
];
 
 const CONTENT_TYPES = [
   { value: 'cbt', label: 'Computer Based Test (CBT)', description: 'Auto-graded multiple choice' },
   { value: 'typed', label: 'Typed Response', description: 'Essay/short answer' },
   { value: 'upload', label: 'File Upload', description: 'Students upload answers' },
 ];
 
 const QUESTION_TYPES = [
   { value: 'multiple_choice', label: 'Multiple Choice' },
   { value: 'true_false', label: 'True/False' },
   { value: 'short_answer', label: 'Short Answer' },
   { value: 'essay', label: 'Essay' },
 ];
 
 export function EnhancedCreateQuizDialog({ open, onOpenChange, defaultClassroomId }: EnhancedCreateQuizDialogProps) {
   const [activeTab, setActiveTab] = useState('basic');
   const [title, setTitle] = useState('');
   const [description, setDescription] = useState('');
   const [quizType, setQuizType] = useState('weekly_test');
   const [contentType, setContentType] = useState('cbt');
   const [classroomId, setClassroomId] = useState(defaultClassroomId || '');
   const [classFilter, setClassFilter] = useState<string>('all');

   // Bug fix: classroomId above was only ever seeded from
   // defaultClassroomId on the dialog's first mount (useState initializer
   // runs once) — since this dialog stays mounted between opens, picking
   // a different class filter on the Quizzes & Tests page afterwards had
   // no effect on what was pre-selected here. Re-sync every time the
   // dialog opens instead, so it always reflects whatever filter is
   // currently active on the page.
   useEffect(() => {
     if (open) {
       setClassroomId(defaultClassroomId || '');
     }
   }, [open, defaultClassroomId]);

   const [durationMinutes, setDurationMinutes] = useState(60);
   const [totalPoints, setTotalPoints] = useState(100);
   const [passingScore, setPassingScore] = useState(50);
   const [autoGrade, setAutoGrade] = useState(true);
   const [shuffleQuestions, setShuffleQuestions] = useState(false);
   const [shuffleOptions, setShuffleOptions] = useState(false);
   const [allowReview, setAllowReview] = useState(true);
   const [startsAt, setStartsAt] = useState('');
   const [endsAt, setEndsAt] = useState('');
  const [broadsheetFieldId, setBroadsheetFieldId] = useState<string | null>(null);
    // Target-field auto-push is being rebuilt — see build_summary.md.
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
   
   // Question builder state
   const [newQuestionType, setNewQuestionType] = useState<QuizQuestion['question_type']>('multiple_choice');
   const [newQuestionText, setNewQuestionText] = useState('');
   const [newQuestionPoints, setNewQuestionPoints] = useState(1);
   const [newQuestionOptions, setNewQuestionOptions] = useState(['', '', '', '']);
   const [newQuestionCorrectAnswer, setNewQuestionCorrectAnswer] = useState(0);
   const [newQuestionRubric, setNewQuestionRubric] = useState('');
   
   // External link import state
   const [externalLink, setExternalLink] = useState('');
   const [importPasteText, setImportPasteText] = useState('');
   const [showImportSection, setShowImportSection] = useState(false);
   const [isImporting, setIsImporting] = useState(false);
   const [importFile, setImportFile] = useState<File | null>(null);
   const [isReadingFile, setIsReadingFile] = useState(false);

   // Editing a question already added to the draft, before the quiz is saved
   const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
 
    const { data: classrooms = [] } = useMyClassrooms();
    const selectedClassroom = classrooms.find((c: any) => c.id === classroomId);

    // Distinct classes across the teacher's classrooms, for the explicit
    // "which class is this quiz for" selector — mirrors the class selector
    // already at the top of the Quizzes page, but scoped to this modal.
    // Picking a class here doesn't need any separate restriction logic:
    // classrooms are already 1:1 with a class_arm, so narrowing the
    // Classroom dropdown to that class's classrooms is the restriction.
    const classOptions = Array.from(
      new Map(
        (classrooms as any[])
          .filter((c) => c.class_arms)
          .map((c) => [c.class_arms.name, c.class_arms])
      ).values()
    );
    const filteredClassrooms = classFilter === 'all'
      ? classrooms
      : (classrooms as any[]).filter((c) => c.class_arms?.name === classFilter);
    // Target-field auto-push is being rebuilt — see build_summary.md.
    const createQuiz = useCreateEnhancedQuiz();
    const addQuestions = useAddQuizQuestions();

   // Parse pasted questions in common formats
   const handleImportFromText = () => {
     if (!importPasteText.trim()) return;
     setIsImporting(true);
     try {
       const parsed: QuizQuestion[] = [];
       // Split by question number patterns: "1.", "1)", "Q1.", "Question 1"
       const blocks = importPasteText.split(/(?=(?:^|\n)\s*(?:\d+[\.\)]\s|Q\d+[\.\)]\s|Question\s+\d+))/i).filter(b => b.trim());
       
       for (const block of blocks) {
         const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
         if (lines.length === 0) continue;
         
         // Extract question text (first line, stripped of numbering)
         const qText = lines[0].replace(/^\s*(?:\d+[\.\)]\s*|Q\d+[\.\)]\s*|Question\s+\d+[:\.\)]*\s*)/i, '').trim();
         if (!qText) continue;
         
         // Extract options (lines starting with A., B., C., D. or a), b), c), d))
         const optionLines = lines.slice(1).filter(l => /^[A-Da-d][\.\)]\s/.test(l));
         const options = optionLines.map(l => l.replace(/^[A-Da-d][\.\)]\s*/, '').trim());
         
         // Try to find correct answer marker (*, (correct), ✓, [correct])
         let correctIndex = 0;
         for (let i = 0; i < optionLines.length; i++) {
           if (/\*|✓|\(correct\)|\[correct\]|correct$/i.test(optionLines[i])) {
             correctIndex = i;
             options[i] = options[i].replace(/\s*[\*✓]|\s*\(correct\)|\s*\[correct\]|\s*correct$/i, '').trim();
           }
         }
         
         // Also check for "Answer: X" line
         const answerLine = lines.find(l => /^answer\s*[:=]\s*/i.test(l));
         if (answerLine) {
           const ans = answerLine.replace(/^answer\s*[:=]\s*/i, '').trim().toUpperCase();
           const idx = ans.charCodeAt(0) - 65;
           if (idx >= 0 && idx < options.length) correctIndex = idx;
         }
         
         if (options.length >= 2) {
           parsed.push({
             question_text: qText,
             question_type: 'multiple_choice',
             points: 1,
             order_index: questions.length + parsed.length,
             options,
             correct_answer: correctIndex,
           });
         } else {
           parsed.push({
             question_text: qText,
             question_type: 'short_answer',
             points: 1,
             order_index: questions.length + parsed.length,
           });
         }
       }
       
       if (parsed.length > 0) {
         setQuestions(prev => [...prev, ...parsed]);
         setImportPasteText('');
         setShowImportSection(false);
         toast.success(`${parsed.length} question(s) imported successfully`);
       } else {
         toast.error('Could not parse any questions. Use format: "1. Question text\\nA. Option\\nB. Option"');
       }
     } catch {
       toast.error('Failed to parse questions');
     } finally {
       setIsImporting(false);
     }
   };
 
   const handleAddQuestion = () => {
     if (!newQuestionText.trim()) return;
 
     const question: QuizQuestion = {
       question_text: newQuestionText.trim(),
       question_type: newQuestionType,
       points: newQuestionPoints,
       order_index: questions.length,
     };
 
     if (newQuestionType === 'multiple_choice') {
       question.options = newQuestionOptions.filter(o => o.trim());
       question.correct_answer = newQuestionCorrectAnswer;
     } else if (newQuestionType === 'true_false') {
       question.options = ['True', 'False'];
       question.correct_answer = newQuestionCorrectAnswer;
     } else if (newQuestionType === 'essay') {
       question.grading_rubric = newQuestionRubric.trim() || undefined;
     }
 
     setQuestions(prev => [...prev, question]);
 
     // Reset form
     setNewQuestionText('');
     setNewQuestionPoints(1);
     setNewQuestionOptions(['', '', '', '']);
     setNewQuestionCorrectAnswer(0);
     setNewQuestionRubric('');
   };
 
   const handleRemoveQuestion = (index: number) => {
     setQuestions(prev => prev.filter((_, i) => i !== index));
   };

   const handleUpdateQuestion = (index: number, updated: QuizQuestion) => {
     setQuestions(prev => prev.map((q, i) => (i === index ? updated : q)));
   };

   // "View Questions": reads the uploaded file's text and drops it straight
   // into the same Paste Questions textarea the copy/paste flow already
   // uses, for review — it does NOT import anything by itself. The existing
   // "Import Questions" button (and its existing parser) does the actual
   // import once the user has had a chance to check/edit the text. A quiz
   // downloaded via ViewQuizDialog's "Download" button is already in this
   // exact format, so the two features form a closed loop.
   const handleViewFileQuestions = async () => {
     if (!importFile) return;
     setIsReadingFile(true);
     try {
       const text = await importFile.text();
       if (!text.trim()) {
         toast.error('That file appears to be empty');
         return;
       }
       setImportPasteText(text);
     } catch {
       toast.error('Could not read that file');
     } finally {
       setIsReadingFile(false);
     }
   };
 
   const handleCreate = async (activateNow: boolean) => {
     if (!title.trim()) return;
     if (!classroomId) return;
 
     const calculatedPoints = questions.reduce((sum, q) => sum + q.points, 0) || totalPoints;
 
     const input: CreateQuizInput = {
       title: title.trim(),
       description: description.trim() || undefined,
       quiz_type: quizType,
       content_type: contentType,
       classroom_id: classroomId,
       duration_minutes: durationMinutes,
       total_points: calculatedPoints,
       total_marks: calculatedPoints,
       passing_score: passingScore,
       auto_grade: autoGrade,
       shuffle_questions: shuffleQuestions,
       shuffle_options: shuffleOptions,
       allow_review: allowReview,
      starts_at: startsAt || undefined,
      ends_at: endsAt || undefined,
      is_active: activateNow,
      broadsheet_field_id: broadsheetFieldId,
    };
 
     const quiz = await createQuiz.mutateAsync(input);
 
     // Add questions if any
     if (questions.length > 0) {
       await addQuestions.mutateAsync({ quizId: quiz.id, questions });
     }
 
     resetForm();
     onOpenChange(false);
   };
 
   const resetForm = () => {
     setTitle('');
     setDescription('');
     setQuizType('weekly');
     setContentType('cbt');
     setDurationMinutes(60);
     setTotalPoints(100);
     setPassingScore(50);
     setAutoGrade(true);
     setShuffleQuestions(false);
     setShuffleOptions(false);
     setAllowReview(true);
     setStartsAt('');
    setEndsAt('');
    setQuestions([]);
    setActiveTab('basic');
    setBroadsheetFieldId(null);
  };
 
   const calculatedTotalPoints = questions.reduce((sum, q) => sum + q.points, 0);
 
   return (
     <>
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <FileQuestion className="h-5 w-5" />
             Create New Quiz
           </DialogTitle>
         </DialogHeader>
 
         <Tabs value={activeTab} onValueChange={setActiveTab}>
           <TabsList className="grid w-full grid-cols-4">
             <TabsTrigger value="basic">Basic Info</TabsTrigger>
             <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
             <TabsTrigger value="settings">Settings</TabsTrigger>
             <TabsTrigger value="schedule">Schedule</TabsTrigger>
           </TabsList>
 
           <TabsContent value="basic" className="space-y-4 py-4">
             <div>
               <Label htmlFor="title">Quiz Title *</Label>
               <Input
                 id="title"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g., Biology Mid-Term Quiz"
               />
             </div>
 
             <div>
               <Label htmlFor="description">Description / Instructions</Label>
               <Textarea
                 id="description"
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 placeholder="Enter instructions for students..."
                 rows={3}
               />
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>Quiz Type *</Label>
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
                 <Label>Format *</Label>
                 <Select value={contentType} onValueChange={setContentType}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {CONTENT_TYPES.map((type) => (
                       <SelectItem key={type.value} value={type.value}>
                         {type.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
 
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label>Class</Label>
                 <Select
                   value={classFilter}
                   onValueChange={(v) => {
                     setClassFilter(v);
                     if (v !== 'all' && classroomId) {
                       const stillValid = (classrooms as any[]).find(
                         (c) => c.id === classroomId && c.class_arms?.name === v
                       );
                       if (!stillValid) setClassroomId('');
                     }
                   }}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="All classes" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All classes</SelectItem>
                     {classOptions.map((cls: any) => (
                       <SelectItem key={cls.name} value={cls.name}>{cls.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Label>Classroom *</Label>
                 <Select value={classroomId} onValueChange={setClassroomId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Select a classroom" />
                   </SelectTrigger>
                   <SelectContent>
                     {filteredClassrooms.map((c: any) => (
                       <SelectItem key={c.id} value={c.id}>
                         {c.name} {c.subjects?.name ? `- ${c.subjects.name}` : ''} {c.class_arms?.name ? `(${c.class_arms.name})` : ''}
                       </SelectItem>
                     ))}
                   </SelectContent>
                  </Select>
                </div>
              </div>

 
             <div className="grid grid-cols-3 gap-4">
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
                 <Label htmlFor="passing">Passing Score (%)</Label>
                 <Input
                   id="passing"
                   type="number"
                   min={0}
                   max={100}
                   value={passingScore}
                   onChange={(e) => setPassingScore(parseInt(e.target.value) || 50)}
                 />
               </div>
               <div>
                 <Label>Total Points</Label>
                 <div className="h-10 flex items-center px-3 bg-muted rounded-md">
                   <span className="font-medium">
                     {calculatedTotalPoints > 0 ? calculatedTotalPoints : totalPoints}
                   </span>
                   <span className="text-muted-foreground ml-1 text-sm">pts</span>
                 </div>
               </div>
             </div>
           </TabsContent>
 
           <TabsContent value="questions" className="space-y-4 py-4">
             {contentType === 'cbt' ? (
               <>
                 {/* Question Builder */}
                 <Card>
                   <CardHeader className="py-3">
                     <CardTitle className="text-sm">Add Question</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label>Question Type</Label>
                         <Select value={newQuestionType} onValueChange={(v) => setNewQuestionType(v as any)}>
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {QUESTION_TYPES.map((type) => (
                               <SelectItem key={type.value} value={type.value}>
                                 {type.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div>
                         <Label>Points</Label>
                         <Input
                           type="number"
                           min={1}
                           value={newQuestionPoints}
                           onChange={(e) => setNewQuestionPoints(parseInt(e.target.value) || 1)}
                         />
                       </div>
                     </div>
 
                     <div>
                       <Label>Question Text *</Label>
                       <Textarea
                         value={newQuestionText}
                         onChange={(e) => setNewQuestionText(e.target.value)}
                         placeholder="Enter your question..."
                         rows={2}
                       />
                     </div>
 
                     {newQuestionType === 'multiple_choice' && (
                       <div className="space-y-2">
                         <Label>Options (click to mark correct)</Label>
                         {newQuestionOptions.map((opt, i) => (
                           <div key={i} className="flex items-center gap-2">
                             <button
                               type="button"
                               onClick={() => setNewQuestionCorrectAnswer(i)}
                               className={`p-1.5 rounded-full border-2 transition-colors ${
                                 newQuestionCorrectAnswer === i
                                   ? 'border-primary bg-primary text-primary-foreground'
                                   : 'border-muted'
                               }`}
                             >
                               {newQuestionCorrectAnswer === i ? (
                                 <CheckCircle2 className="h-4 w-4" />
                               ) : (
                                 <Circle className="h-4 w-4" />
                               )}
                             </button>
                             <Input
                               value={opt}
                               onChange={(e) => {
                                 const newOpts = [...newQuestionOptions];
                                 newOpts[i] = e.target.value;
                                 setNewQuestionOptions(newOpts);
                               }}
                               placeholder={`Option ${String.fromCharCode(65 + i)}`}
                             />
                           </div>
                         ))}
                       </div>
                     )}
 
                     {newQuestionType === 'true_false' && (
                       <div>
                         <Label>Correct Answer</Label>
                         <div className="flex gap-2 mt-2">
                           <Button
                             type="button"
                             variant={newQuestionCorrectAnswer === 0 ? 'default' : 'outline'}
                             onClick={() => setNewQuestionCorrectAnswer(0)}
                           >
                             True
                           </Button>
                           <Button
                             type="button"
                             variant={newQuestionCorrectAnswer === 1 ? 'default' : 'outline'}
                             onClick={() => setNewQuestionCorrectAnswer(1)}
                           >
                             False
                           </Button>
                         </div>
                       </div>
                     )}
 
                     {newQuestionType === 'essay' && (
                       <div>
                         <Label>Grading Rubric / Guidelines</Label>
                         <Textarea
                           value={newQuestionRubric}
                           onChange={(e) => setNewQuestionRubric(e.target.value)}
                           placeholder="Enter grading criteria..."
                           rows={2}
                         />
                       </div>
                     )}
 
                     <Button
                       onClick={handleAddQuestion}
                       disabled={!newQuestionText.trim()}
                       className="w-full gap-2"
                     >
                       <Plus className="h-4 w-4" />
                       Add Question
                     </Button>
                   </CardContent>
                 </Card>

                 {/* Import from External Link / Paste */}
                 <Card className="border-dashed">
                   <CardHeader className="py-3">
                     <div className="flex items-center justify-between">
                       <CardTitle className="text-sm flex items-center gap-2">
                         <Import className="h-4 w-4" />
                         Import Questions
                       </CardTitle>
                       <Button variant="ghost" size="sm" onClick={() => setShowImportSection(!showImportSection)}>
                         {showImportSection ? 'Hide' : 'Show'}
                       </Button>
                     </div>
                   </CardHeader>
                   {showImportSection && (
                     <CardContent className="space-y-4 pt-0">
                       <Alert>
                         <LinkIcon className="h-4 w-4" />
                         <AlertDescription className="text-xs">
                           Paste questions from external CBT platforms, Google Forms, or any text. Use this format:<br />
                           <code className="block mt-1 bg-muted p-2 rounded text-xs">
                             1. What is 2+2?{'\n'}A. 3{'\n'}B. 4 *{'\n'}C. 5{'\n'}D. 6{'\n'}
                             {'\n'}2. The sun is a star{'\n'}A. True *{'\n'}B. False
                           </code>
                           <span className="block mt-1">Mark correct answers with * or (correct)</span>
                         </AlertDescription>
                       </Alert>

                       <div className="space-y-2">
                         <Label>External CBT/Form Link (reference)</Label>
                         <Input
                           value={externalLink}
                           onChange={e => setExternalLink(e.target.value)}
                           placeholder="https://forms.google.com/... or any CBT link"
                         />
                         <p className="text-xs text-muted-foreground">Save the source link for reference. Copy questions from the link and paste below.</p>
                       </div>

                       <div className="space-y-2 border-t pt-4">
                         <Label className="flex items-center gap-1.5">
                           <Upload className="h-3.5 w-3.5" /> Import from File
                         </Label>
                         <p className="text-xs text-muted-foreground">
                           Upload a predownloaded quiz file (e.g. one exported from another quiz's "Download" button), then review it below before importing.
                         </p>
                         <div className="flex gap-2">
                           <Input
                             type="file"
                             accept=".txt"
                             onChange={e => setImportFile(e.target.files?.[0] || null)}
                             className="text-xs"
                           />
                           <Button
                             type="button"
                             variant="outline"
                             className="gap-1.5 shrink-0"
                             onClick={handleViewFileQuestions}
                             disabled={!importFile || isReadingFile}
                           >
                             {isReadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                             View Questions
                           </Button>
                         </div>
                       </div>

                       <div className="space-y-2">
                         <Label>Paste Questions *</Label>
                         <Textarea
                           value={importPasteText}
                           onChange={e => setImportPasteText(e.target.value)}
                           placeholder={"1. What is the capital of Nigeria?\nA. Lagos\nB. Abuja *\nC. Kano\nD. Port Harcourt\n\n2. Python is a programming language\nA. True *\nB. False"}
                           rows={8}
                           className="font-mono text-xs"
                         />
                       </div>

                       <Button
                         onClick={handleImportFromText}
                         disabled={!importPasteText.trim() || isImporting}
                         className="w-full gap-2"
                         variant="secondary"
                       >
                         {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
                         Import Questions
                       </Button>
                     </CardContent>
                   )}
                 </Card>
 
                 {/* Questions List */}
                 <div className="space-y-2">
                   {questions.map((q, i) => (
                     <Card key={i}>
                       <CardContent className="py-3 flex items-start gap-3">
                         <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5" />
                         <div className="flex-1">
                           <div className="flex items-start justify-between gap-2">
                             <p className="font-medium text-sm">
                               {i + 1}. {q.question_text}
                             </p>
                             <div className="flex items-center gap-2">
                               <Badge variant="outline" className="text-xs">
                                 {QUESTION_TYPES.find(t => t.value === q.question_type)?.label}
                               </Badge>
                               <Badge className="text-xs">{q.points} pts</Badge>
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-6 w-6"
                                 onClick={() => setEditingQuestionIndex(i)}
                               >
                                 <Pencil className="h-3 w-3" />
                               </Button>
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 className="h-6 w-6 text-destructive"
                                 onClick={() => handleRemoveQuestion(i)}
                               >
                                 <Trash2 className="h-3 w-3" />
                               </Button>
                             </div>
                           </div>
                           {q.options && (
                             <div className="mt-2 flex flex-wrap gap-1">
                               {q.options.map((opt, oi) => (
                                 <Badge
                                   key={oi}
                                   variant={q.correct_answer === oi ? 'default' : 'secondary'}
                                   className="text-xs"
                                 >
                                   {String.fromCharCode(65 + oi)}. {opt}
                                 </Badge>
                               ))}
                             </div>
                           )}
                         </div>
                       </CardContent>
                     </Card>
                   ))}
 
                   {questions.length === 0 && (
                     <div className="text-center py-8 text-muted-foreground">
                       <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-50" />
                       <p>No questions added yet</p>
                       <p className="text-sm">Add questions using the form above</p>
                     </div>
                   )}
                 </div>
               </>
             ) : (
               <div className="text-center py-8 text-muted-foreground">
                 <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
                 <p>Question builder is only available for CBT format</p>
                 <p className="text-sm">For typed/upload quizzes, students will submit their answers directly</p>
               </div>
             )}
           </TabsContent>
 
           <TabsContent value="settings" className="space-y-4 py-4">
             <div className="space-y-4">
               <div className="flex items-center justify-between p-4 rounded-lg border">
                 <div>
                   <p className="font-medium">Auto-grade MCQ/True-False</p>
                   <p className="text-sm text-muted-foreground">Automatically grade objective questions</p>
                 </div>
                 <Switch checked={autoGrade} onCheckedChange={setAutoGrade} />
               </div>
 
               <div className="flex items-center justify-between p-4 rounded-lg border">
                 <div>
                   <p className="font-medium">Shuffle Questions</p>
                   <p className="text-sm text-muted-foreground">Randomize question order for each student</p>
                 </div>
                 <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
               </div>
 
               <div className="flex items-center justify-between p-4 rounded-lg border">
                 <div>
                   <p className="font-medium">Shuffle Options</p>
                   <p className="text-sm text-muted-foreground">Randomize option order for MCQ</p>
                 </div>
                 <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} />
               </div>
 
               <div className="flex items-center justify-between p-4 rounded-lg border">
                 <div>
                   <p className="font-medium">Allow Review</p>
                   <p className="text-sm text-muted-foreground">Let students review answers after submission</p>
                 </div>
                 <Switch checked={allowReview} onCheckedChange={setAllowReview} />
               </div>

               <div className="p-4 rounded-lg border">
                 <PreCAFieldTargetSelector
                   value={broadsheetFieldId}
                   onChange={setBroadsheetFieldId}
                   subjectId={selectedClassroom?.subject_id}
                   sourceLabel={title.trim() || 'this quiz'}
                 />
               </div>
             </div>
           </TabsContent>
 
           <TabsContent value="schedule" className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <Label htmlFor="starts-at">Starts At</Label>
                 <div className="flex items-center gap-2 mt-1">
                   <Calendar className="h-4 w-4 text-muted-foreground" />
                   <Input
                     id="starts-at"
                     type="datetime-local"
                     value={startsAt}
                     onChange={(e) => setStartsAt(e.target.value)}
                   />
                 </div>
               </div>
               <div>
                 <Label htmlFor="ends-at">Ends At</Label>
                 <div className="flex items-center gap-2 mt-1">
                   <Clock className="h-4 w-4 text-muted-foreground" />
                   <Input
                     id="ends-at"
                     type="datetime-local"
                     value={endsAt}
                     onChange={(e) => setEndsAt(e.target.value)}
                   />
                 </div>
               </div>
             </div>
 
             <div className="p-4 rounded-lg bg-muted/50 flex items-start gap-3">
               <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
               <div className="text-sm text-muted-foreground">
                 <p className="font-medium text-foreground">Activation Info</p>
                 <p>
                   Save as inactive to continue editing. Activate when ready for students to take the quiz.
                   If you set start/end times, students can only access during that window.
                 </p>
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
             disabled={createQuiz.isPending || addQuestions.isPending}
           >
             {(createQuiz.isPending || addQuestions.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
             Save (Inactive)
           </Button>
           <Button
             onClick={() => handleCreate(true)}
             disabled={createQuiz.isPending || addQuestions.isPending}
           >
             {(createQuiz.isPending || addQuestions.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
             Save & Activate
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
     {editingQuestionIndex !== null && questions[editingQuestionIndex] && (
       <EditDraftQuestionDialog
         open={editingQuestionIndex !== null}
         onOpenChange={(open) => !open && setEditingQuestionIndex(null)}
         question={questions[editingQuestionIndex]}
         onSave={(updated) => handleUpdateQuestion(editingQuestionIndex, updated)}
       />
     )}
     </>
   );
 }
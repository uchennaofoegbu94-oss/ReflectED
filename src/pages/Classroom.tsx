import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CreateClassroomDialog } from '@/components/classroom/CreateClassroomDialog';
import { ClassroomSettingsDialog } from '@/components/classroom/ClassroomSettingsDialog';
import { SyllabusTab } from '@/components/classroom/SyllabusTab';
import { LiveClassTab } from '@/components/classroom/LiveClassTab';
import { StreamTab } from '@/components/classroom/StreamTab';
import { ClassworkTab } from '@/components/classroom/ClassworkTab';
import { PeopleTab } from '@/components/classroom/PeopleTab';
import { GradesTab } from '@/components/classroom/GradesTab';
import { MaterialsTab } from '@/components/classroom/MaterialsTab';
import { PastQuestionsTab } from '@/components/classroom/PastQuestionsTab';
import { useAuth } from '@/contexts/AuthContext';
import { useProctorMode } from '@/hooks/useSchoolSettings';
import { useClassroomData, useMyClassrooms } from '@/hooks/useClassroomData';
import { toast } from 'sonner';
import {
  Plus,
  Settings,
  Users,
  BookOpen,
  FileText,
  MessageSquare,
  Video,
  Loader2,
  X,
  Calendar,
  Upload,
  FolderOpen,
  Archive,
} from 'lucide-react';

export default function ClassroomPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('stream');
  const [selectedClassroom, setSelectedClassroom] = useState<string | null>(searchParams.get('id'));
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';
  const isStudent = user?.role === 'student';
  const { data: proctorMode } = useProctorMode();
  const proctorActive = isStudent && !!proctorMode;

  const { data: myClassrooms = [], isLoading: loadingClassrooms } = useMyClassrooms();
  const classroomId = selectedClassroom || (myClassrooms.length > 0 ? myClassrooms[0].id : undefined);

  const {
    classroom,
    posts,
    assignments,
    members,
    isLoading,
    createPost,
    createComment,
    createAssignment,
    uploadFile,
  } = useClassroomData(classroomId);

  if (loadingClassrooms) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (myClassrooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Classrooms Found</h2>
        <p className="text-muted-foreground">
          {isTeacher ? "You haven't created any classrooms yet." : "You're not enrolled in any classrooms."}
        </p>
        {isTeacher && <CreateClassroomDialog />}
      </div>
    );
  }

  const currentClassroom = classroom || myClassrooms[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Classroom Selector */}
      {myClassrooms.length > 1 && (
        <Select value={classroomId} onValueChange={setSelectedClassroom}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a classroom" />
          </SelectTrigger>
          <SelectContent>
            {myClassrooms.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} - {c.class_arms?.name || 'No Class'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Header Banner */}
      <div
        className="relative h-48 rounded-2xl overflow-hidden bg-cover bg-center"
        style={
          currentClassroom?.banner_image_url
            ? { backgroundImage: `url(${currentClassroom.banner_image_url})` }
            : { background: `linear-gradient(135deg, ${currentClassroom?.banner_color || '#0B1F3B'} 0%, #1FA4A9 100%)` }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white font-display">{currentClassroom?.name || 'Classroom'}</h1>
              <p className="text-white/80 mt-1">{currentClassroom?.description || ''}</p>
              <Badge className="mt-2 bg-white/20 text-white border-white/30">
                Class Code: {currentClassroom?.code || 'N/A'}
              </Badge>
            </div>
            <div className="flex gap-2">
              {isTeacher && currentClassroom && (
                <>
                  <Button variant="secondary" size="sm" className="gap-2" onClick={() => setShowSettings(true)}>
                    <Settings size={16} />
                    Settings
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        {isTeacher && currentClassroom && (
          <ClassroomSettingsDialog open={showSettings} onOpenChange={setShowSettings} classroom={currentClassroom} />
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
          <TabsTrigger value="stream" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
            <MessageSquare size={18} /> Stream
          </TabsTrigger>
          {!proctorActive && (
            <TabsTrigger value="classwork" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
              <BookOpen size={18} /> Classwork
            </TabsTrigger>
          )}
          <TabsTrigger value="people" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
            <Users size={18} /> People
          </TabsTrigger>
          {!proctorActive && (
            <TabsTrigger value="syllabus" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
              <FileText size={18} /> Syllabus
            </TabsTrigger>
          )}
          {!proctorActive && (
            <TabsTrigger value="live" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
              <Video size={18} /> Live Class
            </TabsTrigger>
          )}
          {!proctorActive && (
            <TabsTrigger value="materials" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
              <FolderOpen size={18} /> Materials
            </TabsTrigger>
          )}
          {!proctorActive && (
            <TabsTrigger value="past-questions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
              <Archive size={18} /> Past Questions
            </TabsTrigger>
          )}
          {isTeacher && (
            <TabsTrigger value="grades" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-6 py-3 gap-2">
              <Calendar size={18} /> Grades
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stream" className="mt-6">
          <StreamTab
            isTeacher={isTeacher}
            user={user}
            posts={posts}
            assignments={assignments}
            isLoading={isLoading}
            createPost={createPost}
            createComment={createComment}
            uploadFile={uploadFile}
            onSwitchTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="classwork" className="mt-6">
          <ClassworkTab
            isTeacher={isTeacher}
            isLoading={isLoading}
            assignments={assignments}
            createAssignment={createAssignment}
            uploadFile={uploadFile}
            onShowCreateAssignment={() => setShowCreateAssignment(true)}
          />
          {/* Create Assignment Dialog */}
          <Dialog open={showCreateAssignment} onOpenChange={setShowCreateAssignment}>
            <DialogContent className="max-w-lg">
              <CreateAssignmentForm
                onSubmit={async (data) => {
                  await createAssignment.mutateAsync(data);
                  setShowCreateAssignment(false);
                }}
                isLoading={createAssignment.isPending}
                uploadFile={uploadFile}
              />
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="people" className="mt-6">
          <PeopleTab user={user} members={members} />
        </TabsContent>

        <TabsContent value="syllabus" className="mt-6">
          {classroomId && <SyllabusTab classroomId={classroomId} isTeacher={isTeacher} />}
        </TabsContent>

        <TabsContent value="live" className="mt-6">
          {classroomId && <LiveClassTab classroomId={classroomId} isTeacher={isTeacher} />}
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          {classroomId && <MaterialsTab classroomId={classroomId} isTeacher={isTeacher} />}
        </TabsContent>

        <TabsContent value="past-questions" className="mt-6">
          {classroomId && <PastQuestionsTab classroomId={classroomId} />}
        </TabsContent>

        {isTeacher && (
          <TabsContent value="grades" className="mt-6">
            <GradesTab members={members} assignments={assignments} classroomId={classroomId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// Create Assignment Form Component
function CreateAssignmentForm({
  onSubmit,
  isLoading,
  uploadFile,
}: {
  onSubmit: (data: any) => Promise<void>;
  isLoading: boolean;
  uploadFile: (file: File) => Promise<any>;
}) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [topic, setTopic] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [points, setPoints] = useState('100');
  const [allowLate, setAllowLate] = useState(true);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadFile(file);
        setAttachments(prev => [...prev, result]);
      }
    } catch (error: any) {
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    await onSubmit({
      title,
      instructions,
      topic,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      points: parseInt(points) || 100,
      allowLateSubmission: allowLate,
      attachments,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader><DialogTitle>Create Assignment</DialogTitle></DialogHeader>
      <div className="space-y-4 py-4">
        <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assignment title" /></div>
        <div><Label>Instructions</Label><Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What should students do?" className="min-h-[100px]" /></div>
        <div><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Chapter 4: Quadratic Equations" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div><Label>Due Time</Label><Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} /></div>
        </div>
        <div><Label>Points</Label><Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} min="0" /></div>
        <div className="flex items-center justify-between"><Label>Allow Late Submissions</Label><Switch checked={allowLate} onCheckedChange={setAllowLate} /></div>
        <div>
          <Label>Attachments</Label>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          <Button type="button" variant="outline" className="w-full mt-2 gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Upload Files
          </Button>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((att, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {att.name}
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}><X size={12} /></button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          Create Assignment
        </Button>
      </DialogFooter>
    </form>
  );
}

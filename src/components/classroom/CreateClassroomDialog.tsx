import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useCreateClassroom, useUpdateClassroom } from '@/hooks/useClassroomManagement';
import { useSubjects } from '@/hooks/useSubjects';
import { useClassArms } from '@/hooks/useClassArms';

const bannerColors = [
  { name: 'Navy', value: '#0B1F3B' },
  { name: 'Teal', value: '#1FA4A9' },
  { name: 'Coral', value: '#FF6B35' },
  { name: 'Purple', value: '#6B46C1' },
  { name: 'Green', value: '#059669' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Red', value: '#DC2626' },
  { name: 'Orange', value: '#EA580C' },
];

interface CreateClassroomDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editingClassroom?: {
    id: string;
    name: string;
    description?: string;
    subject_id?: string;
    class_id?: string;
    banner_color?: string;
  } | null;
  trigger?: React.ReactNode;
}

export function CreateClassroomDialog({ 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange,
  editingClassroom,
  trigger 
}: CreateClassroomDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const onOpenChange = controlledOnOpenChange || setInternalOpen;

  const [name, setName] = useState(editingClassroom?.name || '');
  const [description, setDescription] = useState(editingClassroom?.description || '');
  const [subjectId, setSubjectId] = useState(editingClassroom?.subject_id || '');
  const [classId, setClassId] = useState(editingClassroom?.class_id || '');
  const [bannerColor, setBannerColor] = useState(editingClassroom?.banner_color || '#0B1F3B');

  const createClassroom = useCreateClassroom();
  const updateClassroom = useUpdateClassroom();
  const { data: subjects = [] } = useSubjects();
  const { data: classArms = [] } = useClassArms();

  const isEditing = !!editingClassroom;
  const isLoading = createClassroom.isPending || updateClassroom.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      subject_id: subjectId || undefined,
      class_id: classId || undefined,
      banner_color: bannerColor,
    };

    if (isEditing) {
      await updateClassroom.mutateAsync({ id: editingClassroom.id, ...data });
    } else {
      await createClassroom.mutateAsync(data);
    }
    
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    if (!isEditing) {
      setName('');
      setDescription('');
      setSubjectId('');
      setClassId('');
      setBannerColor('#0B1F3B');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="btn-accent gap-2">
            <Plus size={18} />
            Create Classroom
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Classroom' : 'Create Classroom'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Classroom Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mathematics SS2"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this classroom"
                className="min-h-[80px]"
              />
            </div>

            <div>
              <Label>Subject (Optional)</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject</SelectItem>
                  {subjects.map((subject: any) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Class (Optional)</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No class</SelectItem>
                  {classArms.map((classArm: any) => (
                    <SelectItem key={classArm.id} value={classArm.id}>
                      {classArm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Banner Color</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {bannerColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-all ${
                      bannerColor === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setBannerColor(color.value)}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading && <Loader2 size={16} className="mr-2 animate-spin" />}
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

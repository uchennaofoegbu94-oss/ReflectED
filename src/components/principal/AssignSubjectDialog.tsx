import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSubjects, useClassSubjects, useAssignSubjectToClass } from '@/hooks/useSubjects';
import { useStaff } from '@/hooks/useStaff';
import { useClassArms } from '@/hooks/useClassArms';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AssignSubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
}

export function AssignSubjectDialog({ open, onOpenChange, classId }: AssignSubjectDialogProps) {
  const { data: subjects = [] } = useSubjects();
  const { data: classSubjects = [] } = useClassSubjects();
  const { data: staff = [] } = useStaff();
  const { data: classArms = [] } = useClassArms();
  const assignSubject = useAssignSubjectToClass();
  
  const [formData, setFormData] = useState({
    subject_id: '',
    teacher_id: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const classInfo = classArms.find(c => c.id === classId);
  const assignedSubjectIds = classSubjects
    .filter(cs => cs.class_id === classId)
    .map(cs => cs.subject_id);
  const availableSubjects = subjects.filter(s => !assignedSubjectIds.includes(s.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject_id || !classId) {
      toast.error('Please select a subject');
      return;
    }
    
    setIsLoading(true);

    try {
      await assignSubject.mutateAsync({
        class_id: classId,
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id || null,
      });
      
      toast.success('Subject assigned to class successfully');
      onOpenChange(false);
      setFormData({ subject_id: '', teacher_id: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign subject');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assign Subject to {classInfo ? `${classInfo.name} ${classInfo.arm}` : 'Class'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Select
              value={formData.subject_id}
              onValueChange={(v) => setFormData({ ...formData, subject_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableSubjects.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All subjects are already assigned to this class
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Subject Teacher (Optional)</Label>
            <Select
              value={formData.teacher_id || "none"}
              onValueChange={(v) => setFormData({ ...formData, teacher_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {staff.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.first_name} {teacher.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.subject_id}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Subject
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

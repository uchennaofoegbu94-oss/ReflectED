import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudents, useUpdateStudent } from '@/hooks/useStudents';
import { useClassArms } from '@/hooks/useClassArms';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AssignStudentToClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
}

export function AssignStudentToClassDialog({ open, onOpenChange, classId }: AssignStudentToClassDialogProps) {
  const { data: students = [] } = useStudents();
  const { data: classArms = [] } = useClassArms();
  const updateStudent = useUpdateStudent();
  
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const classInfo = classArms.find(c => c.id === classId);
  const unassignedStudents = students.filter(s => !s.class_id || s.class_id !== classId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !classId) {
      toast.error('Please select a student');
      return;
    }
    
    setIsLoading(true);

    try {
      await updateStudent.mutateAsync({
        id: selectedStudent,
        class_id: classId,
      });
      
      toast.success('Student assigned to class successfully');
      onOpenChange(false);
      setSelectedStudent('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign student');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add Student to {classInfo ? `${classInfo.name} ${classInfo.arm}` : 'Class'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Student *</Label>
            <Select
              value={selectedStudent}
              onValueChange={setSelectedStudent}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {unassignedStudents.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.first_name} {student.last_name} ({student.admission_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unassignedStudents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All students are already assigned to this class
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !selectedStudent}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Student
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

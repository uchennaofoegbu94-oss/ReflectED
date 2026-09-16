import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateClassArm } from '@/hooks/useClassArms';
import { useStaff } from '@/hooks/useStaff';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type ClassArm = Database['public']['Tables']['class_arms']['Row'];

interface EditClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classArm: ClassArm | null;
}

export function EditClassDialog({ open, onOpenChange, classArm }: EditClassDialogProps) {
  const { data: staff = [] } = useStaff();
  const updateClassArm = useUpdateClassArm();

  const [formData, setFormData] = useState({
    name: '',
    arm: '',
    level: '' as 'primary' | 'junior_secondary' | 'senior_secondary',
    class_teacher_id: '',
  });

  useEffect(() => {
    if (classArm) {
      setFormData({
        name: classArm.name,
        arm: classArm.arm,
        level: classArm.level,
        class_teacher_id: classArm.class_teacher_id || '',
      });
    }
  }, [classArm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classArm) return;

    if (!formData.name || !formData.arm || !formData.level) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await updateClassArm.mutateAsync({
        id: classArm.id,
        name: formData.name,
        arm: formData.arm,
        level: formData.level,
        class_teacher_id: formData.class_teacher_id || null,
      });
      toast.success('Class updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update class');
    }
  };

  const teachers = staff.filter(s => s.employment_status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Class</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., JSS 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arm">Arm *</Label>
              <Input
                id="arm"
                value={formData.arm}
                onChange={(e) => setFormData({ ...formData, arm: e.target.value })}
                placeholder="e.g., A"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Level *</Label>
            <Select
              value={formData.level}
              onValueChange={(value: 'primary' | 'junior_secondary' | 'senior_secondary') =>
                setFormData({ ...formData, level: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="junior_secondary">Junior Secondary</SelectItem>
                <SelectItem value="senior_secondary">Senior Secondary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="class_teacher">Class Teacher</Label>
            <Select
              value={formData.class_teacher_id || "none"}
              onValueChange={(value) => setFormData({ ...formData, class_teacher_id: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No class teacher</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.first_name} {teacher.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateClassArm.isPending}>
              {updateClassArm.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

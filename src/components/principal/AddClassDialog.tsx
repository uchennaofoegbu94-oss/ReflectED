import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateClassArm } from '@/hooks/useClassArms';
import { useStaff } from '@/hooks/useStaff';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type ClassLevel = Database['public']['Enums']['class_level'];

interface AddClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddClassDialog({ open, onOpenChange }: AddClassDialogProps) {
  const createClass = useCreateClassArm();
  const { data: staff = [] } = useStaff();
  
  const [formData, setFormData] = useState({
    name: '',
    arm: '',
    level: '' as ClassLevel | '',
    class_teacher_id: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.arm || !formData.level) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);

    try {
      await createClass.mutateAsync({
        name: formData.name,
        arm: formData.arm,
        level: formData.level as ClassLevel,
        class_teacher_id: formData.class_teacher_id || null,
      });
      
      toast.success('Class created successfully');
      onOpenChange(false);
      setFormData({ name: '', arm: '', level: '', class_teacher_id: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create class');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Class</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Class Name *</Label>
              <Input
                id="name"
                placeholder="e.g., JSS 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arm">Arm *</Label>
              <Input
                id="arm"
                placeholder="e.g., A, B, C"
                value={formData.arm}
                onChange={(e) => setFormData({ ...formData, arm: e.target.value.toUpperCase() })}
                maxLength={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level">Level *</Label>
            <Select
              value={formData.level}
              onValueChange={(value) => setFormData({ ...formData, level: value as ClassLevel })}
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
            <Label htmlFor="class_teacher">Class Teacher (Optional)</Label>
            <Select
              value={formData.class_teacher_id || "none"}
              onValueChange={(value) => setFormData({ ...formData, class_teacher_id: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class teacher" />
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
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Class
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSpecialRole, SpecialRoleType, STAFF_ROLES, STUDENT_ROLES, ROLE_LABELS } from '@/hooks/useSpecialRoles';
import { useRoleDefinitions } from '@/hooks/useRoleDefinitions';
import { useStaff } from '@/hooks/useStaff';
import { useStudents } from '@/hooks/useStudents';
import { useClassArms } from '@/hooks/useClassArms';
import { useActiveSession } from '@/hooks/useAcademicData';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AssignRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'staff' | 'student';
}

export function AssignRoleDialog({ open, onOpenChange, type }: AssignRoleDialogProps) {
  const { user } = useAuth();
  const createRole = useCreateSpecialRole();
  const { data: staff = [] } = useStaff();
  const { data: students = [] } = useStudents();
  const { data: classArms = [] } = useClassArms();
  const { data: activeSession } = useActiveSession();
  const { data: roleDefinitions = [] } = useRoleDefinitions(type);
  
  const [formData, setFormData] = useState({
    roleKey: '',
    personId: '',
    classId: '',
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const people = type === 'staff' ? staff : students;

  // Check if selected role key is a system enum role
  const systemEnumRoles = type === 'staff' ? STAFF_ROLES : STUDENT_ROLES;
  const isSystemEnumRole = systemEnumRoles.includes(formData.roleKey as SpecialRoleType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roleKey || !formData.personId || !user?.id) return;
    
    setIsLoading(true);

    try {
      const rolePayload: any = {
        role_type: isSystemEnumRole ? formData.roleKey : 'form_teacher', // fallback enum value for custom roles
        staff_id: type === 'staff' ? formData.personId : null,
        student_id: type === 'student' ? formData.personId : null,
        class_id: formData.classId || null,
        session_id: activeSession?.id || null,
        assigned_by: user.id,
        notes: formData.notes || null,
      };

      // For custom (non-enum) roles, store the key in custom_role_name
      if (!isSystemEnumRole) {
        rolePayload.custom_role_name = formData.roleKey;
      }

      await createRole.mutateAsync(rolePayload);
      
      toast.success('Role assigned successfully');
      onOpenChange(false);
      setFormData({ roleKey: '', personId: '', classId: '', notes: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign role');
    } finally {
      setIsLoading(false);
    }
  };

  const needsClass = formData.roleKey === 'form_teacher' || formData.roleKey === 'class_prefect';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assign {type === 'staff' ? 'Teacher' : 'Student'} Role
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select {type === 'staff' ? 'Teacher' : 'Student'} *</Label>
            <Select
              value={formData.personId}
              onValueChange={(value) => setFormData({ ...formData, personId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Choose a ${type === 'staff' ? 'teacher' : 'student'}`} />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Role *</Label>
            <Select
              value={formData.roleKey}
              onValueChange={(value) => setFormData({ ...formData, roleKey: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleDefinitions.map((rd) => (
                  <SelectItem key={rd.key} value={rd.key}>
                    {rd.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsClass && (
            <div className="space-y-2">
              <Label>Class</Label>
              <Select
                value={formData.classId}
                onValueChange={(value) => setFormData({ ...formData, classId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classArms.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} {cls.arm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.roleKey || !formData.personId}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Role
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

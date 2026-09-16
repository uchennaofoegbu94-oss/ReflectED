import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateStaff, Staff } from '@/hooks/useStaff';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AddTeacherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher?: Staff | null;
}

const getInitialFormData = (teacher?: Staff | null) => ({
  email: teacher?.email || '',
  password: '',
  firstName: teacher?.first_name || '',
  lastName: teacher?.last_name || '',
  middleName: teacher?.middle_name || '',
  phone: teacher?.phone || '',
  gender: teacher?.gender || 'male',
  qualification: teacher?.qualification || '',
  employeeId: teacher?.employee_id || '',
});

export function AddTeacherDialog({ open, onOpenChange, teacher }: AddTeacherDialogProps) {
  const isEdit = !!teacher;
  const updateStaff = useUpdateStaff();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState(getInitialFormData(teacher));
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when dialog opens with a teacher or closes
  useEffect(() => {
    if (open) {
      setFormData(getInitialFormData(teacher));
    }
  }, [open, teacher]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isEdit && teacher) {
        // Update existing teacher
        await updateStaff.mutateAsync({
          id: teacher.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          middle_name: formData.middleName || null,
          phone: formData.phone || null,
          gender: formData.gender,
          qualification: formData.qualification || null,
        });
        toast.success('Teacher updated successfully');
      } else {
        // Server-side via edge function — creates the auth user with
        // the admin API, which never touches this browser's own
        // session (unlike calling supabase.auth.signUp() from the
        // admin's own tab, which silently swaps the active session to
        // the newly created user and, if anything after that failed,
        // left the admin stuck logged in as the broken new account).
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error('Not authenticated');

        const empId = formData.employeeId || `TCH-${Date.now().toString().slice(-6)}`;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-staff-member`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              full_name: `${formData.firstName} ${formData.lastName}`,
              role: 'teacher',
              employee_id: empId,
              first_name: formData.firstName,
              last_name: formData.lastName,
              middle_name: formData.middleName || undefined,
              phone: formData.phone || undefined,
              gender: formData.gender,
              qualification: formData.qualification || undefined,
            }),
          },
        );
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to add teacher');
        if (result.warning) toast.warning(result.warning);

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['staff'] }),
          queryClient.invalidateQueries({ queryKey: ['teachers'] }),
        ]);

        toast.success('Teacher added successfully');
      }
      
      onOpenChange(false);
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        middleName: '',
        phone: '',
        gender: 'male',
        qualification: '',
        employeeId: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to save teacher');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="Auto-generated if empty"
                disabled={isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qualification">Qualification</Label>
              <Input
                id="qualification"
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                placeholder="e.g., B.Ed, M.Sc"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Add Teacher'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

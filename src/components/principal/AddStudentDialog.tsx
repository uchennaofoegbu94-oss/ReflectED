import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateStudent, useUpdateStudent } from '@/hooks/useStudents';
import { useClassArms } from '@/hooks/useClassArms';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { StudentWithClass } from '@/hooks/useStudents';

interface AddStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: StudentWithClass | null;
}

export function AddStudentDialog({ open, onOpenChange, student }: AddStudentDialogProps) {
  const isEdit = !!student;
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const { data: classArms = [] } = useClassArms();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    gender: 'male' as 'male' | 'female',
    dateOfBirth: '',
    classId: '',
    admissionNumber: '',
    enrollmentStatus: 'active' as 'active' | 'graduated' | 'transferred' | 'suspended',
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when dialog opens/closes or student changes
  useEffect(() => {
    if (open) {
      setFormData({
        firstName: student?.first_name || '',
        lastName: student?.last_name || '',
        middleName: student?.middle_name || '',
        gender: student?.gender || 'male',
        dateOfBirth: student?.date_of_birth || '',
        classId: student?.class_id || '',
        admissionNumber: student?.admission_number || '',
        enrollmentStatus: student?.enrollment_status || 'active',
        email: '',
        password: '',
      });
    }
  }, [open, student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isEdit && student) {
        await updateStudent.mutateAsync({
          id: student.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          middle_name: formData.middleName || null,
          gender: formData.gender,
          date_of_birth: formData.dateOfBirth || null,
          class_id: formData.classId || null,
          enrollment_status: formData.enrollmentStatus,
        });
        toast.success('Student updated successfully');
      } else {
        // Validate email and password for new students
        if (!formData.email || !formData.password) {
          toast.error('Email and password are required for new students');
          setIsLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }

        // Create the auth user + role server-side via the service role —
        // never touches this admin's own browser session, unlike the old
        // supabase.auth.signUp() call this replaced, which briefly swapped
        // the active session over to the newly created student and never
        // set school_id/role in signup metadata at all.
        const { data: sessionData } = await supabase.auth.getSession();
        const { data: fnResult, error: fnError } = await supabase.functions.invoke('create-student-account', {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: `${formData.firstName} ${formData.lastName}`,
          },
          headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
        });

        if (fnError) throw fnError;
        if (fnResult?.error) throw new Error(fnResult.error);

        const newUserId = fnResult.user_id;

        // Generate admission number if not provided
        const admNo = formData.admissionNumber || `STU-${Date.now().toString().slice(-6)}`;
        
        await createStudent.mutateAsync({
          first_name: formData.firstName,
          last_name: formData.lastName,
          middle_name: formData.middleName || null,
          gender: formData.gender,
          date_of_birth: formData.dateOfBirth || null,
          class_id: formData.classId || null,
          admission_number: admNo,
          enrollment_status: formData.enrollmentStatus,
          user_id: newUserId,
        });
        toast.success('Student added successfully');
      }
      
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save student');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Student' : 'Add New Student'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={formData.gender}
                onValueChange={(value: 'male' | 'female') => setFormData({ ...formData, gender: value })}
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
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admissionNumber">Admission Number</Label>
              <Input
                id="admissionNumber"
                value={formData.admissionNumber}
                onChange={(e) => setFormData({ ...formData, admissionNumber: e.target.value })}
                placeholder="Auto-generated if empty"
                disabled={isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classId">Class *</Label>
              <Select
                value={formData.classId || "none"}
                onValueChange={(value) => setFormData({ ...formData, classId: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select class</SelectItem>
                  {classArms.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} {cls.arm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="enrollmentStatus">Enrollment Status</Label>
            <Select
              value={formData.enrollmentStatus}
              onValueChange={(value: 'active' | 'graduated' | 'transferred' | 'suspended') => setFormData({ ...formData, enrollmentStatus: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Auth credentials section - only for new students */}
          {!isEdit && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground mb-3">Login Credentials</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@example.com"
                    required={!isEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min. 6 characters"
                    required={!isEdit}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Add Student'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

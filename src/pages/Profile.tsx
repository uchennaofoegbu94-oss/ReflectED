import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { IDCardFront, IDCardBack } from '@/components/shared/PersonIDCard';
import { Loader2, User, Mail, Phone, Calendar, Briefcase, Camera, Lock, Users, CreditCard } from 'lucide-react';

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
}

interface StaffData {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  phone: string;
  gender: string;
  qualification: string;
  employee_id: string;
  date_of_birth: string;
}

interface StudentData {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  gender: string;
  admission_number: string;
  date_of_birth: string;
  parent_name: string | null;
  class_name: string | null;
}

export default function Profile() {
  const { user, session, refreshUser } = useAuth();
  const { school } = useSchool();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: '',
  });
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });

  const isStaffRole = user?.role && ['admin', 'principal', 'teacher', 'accountant'].includes(user.role);
  const isStudentRole = user?.role === 'student';
  const isParentRole = user?.role === 'parent';

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfileData();
    }
  }, [session?.user?.id]);

  const fetchProfileData = async () => {
    if (!session?.user?.id) return;
    
    setIsLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (profile) {
        setProfileData({
          full_name: profile.full_name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          avatar_url: profile.avatar_url || '',
        });
      }

      if (isStaffRole) {
        const { data: staff } = await supabase
          .from('staff')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (staff) {
          setStaffData({
            id: staff.id,
            first_name: staff.first_name || '',
            last_name: staff.last_name || '',
            middle_name: staff.middle_name || '',
            phone: staff.phone || '',
            gender: staff.gender || 'male',
            qualification: staff.qualification || '',
            employee_id: staff.employee_id || '',
            date_of_birth: staff.date_of_birth || '',
          });
        }
      }

      if (isStudentRole) {
        const { data: student } = await supabase
          .from('students')
          .select('id, first_name, last_name, middle_name, gender, admission_number, date_of_birth, parent_id, class_arms (name, arm)')
          .eq('user_id', session.user.id)
          .maybeSingle();

        let parentName: string | null = null;
        if (student?.parent_id) {
          const { data: parentProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', student.parent_id)
            .maybeSingle();
          parentName = parentProfile?.full_name || null;
        }

        if (student) {
          setStudentData({
            id: student.id,
            first_name: student.first_name || '',
            last_name: student.last_name || '',
            middle_name: student.middle_name || '',
            gender: student.gender || 'male',
            admission_number: student.admission_number || '',
            date_of_birth: student.date_of_birth || '',
            parent_name: parentName,
            class_name: (student as any).class_arms ? `${(student as any).class_arms.name} ${(student as any).class_arms.arm}` : null,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;

    setIsSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
        })
        .eq('user_id', session.user.id);

      if (profileError) throw profileError;

      if (isStaffRole && staffData) {
        const { error: staffError } = await supabase
          .from('staff')
          .update({
            first_name: staffData.first_name,
            last_name: staffData.last_name,
            middle_name: staffData.middle_name || null,
            phone: staffData.phone || null,
            gender: staffData.gender,
            qualification: staffData.qualification || null,
            date_of_birth: staffData.date_of_birth || null,
          })
          .eq('user_id', session.user.id);

        if (staffError) throw staffError;
      }

      // Students cannot edit their own info (handled by UI being read-only)
      // Parent profile just saves profile-level data (name, phone)

      // These edits (name, phone, etc.) are cached elsewhere too — the
      // admin Teachers/Students lists, header/sidebar (via AuthContext),
      // ID cards, and anywhere else that reads staff/students/profiles
      // through react-query. None of that refetches on its own just
      // because this page saved something, so it stays stale until a
      // hard reload without this.
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      await refreshUser();

      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      return toast.error('Please fill in both password fields');
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (passwordData.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      if (error) throw error;
      toast.success('Password changed successfully');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session?.user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', session.user.id);

      if (updateError) throw updateError;

      if (isStaffRole) {
        await supabase
          .from('staff')
          .update({ avatar_url: avatarUrl })
          .eq('user_id', session.user.id);
      } else if (isStudentRole) {
        await supabase
          .from('students')
          .update({ avatar_url: avatarUrl })
          .eq('user_id', session.user.id);
      }

      setProfileData({ ...profileData, avatar_url: avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      await refreshUser();
      toast.success('Avatar updated successfully');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal information</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center pt-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profileData.avatar_url} alt={profileData.full_name} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials(profileData.full_name || 'U')}
                </AvatarFallback>
              </Avatar>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarUpload}
                accept="image/*"
                className="hidden"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
               title="Change photo">
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{profileData.full_name}</h2>
            <p className="text-sm capitalize text-muted-foreground">{user?.role}</p>
            <div className="mt-4 w-full space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="truncate">{profileData.email || session?.user?.email}</span>
              </div>
              {profileData.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{profileData.phone}</span>
                </div>
              )}
              {isStaffRole && staffData?.employee_id && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>{staffData.employee_id}</span>
                </div>
              )}
              {isStudentRole && studentData?.admission_number && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{studentData.admission_number}</span>
                </div>
              )}
              {isStudentRole && studentData?.parent_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Parent: {studentData.parent_name}</span>
                </div>
              )}
              {isParentRole && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Parent/Guardian</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Digital ID — same front/back design as the physical cards
            admins print from ID Cards, so students and staff always have
            it on hand (e.g. for QR attendance scanning) even without a
            printed card on them. Only rendered for students/staff, since
            that's who ID Cards issues cards for in the first place. */}
        {(isStaffRole && staffData) || (isStudentRole && studentData) ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                My Digital ID
              </CardTitle>
              <CardDescription>Front and back — the QR code works the same as your printed card for attendance scanning.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {isStaffRole && staffData && (
                <>
                  <IDCardFront
                    person={{ ...staffData, avatar_url: profileData.avatar_url }}
                    type="staff"
                    schoolName={school?.name || 'School'}
                    schoolLogo={school?.logo_url}
                  />
                  <IDCardBack
                    person={staffData}
                    type="staff"
                    schoolName={school?.name || 'School'}
                    schoolId={school?.id}
                  />
                </>
              )}
              {isStudentRole && studentData && (
                <>
                  <IDCardFront
                    person={{ ...studentData, avatar_url: profileData.avatar_url }}
                    type="student"
                    schoolName={school?.name || 'School'}
                    schoolLogo={school?.logo_url}
                    className={studentData.class_name || undefined}
                  />
                  <IDCardBack
                    person={studentData}
                    type="student"
                    schoolName={school?.name || 'School'}
                    schoolId={school?.id}
                  />
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Edit Form */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                {isStudentRole 
                  ? 'View your personal details. Contact your school admin to update your information.'
                  : 'Update your personal details below'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isStudentRole && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
              )}

              {/* Staff-specific fields */}
              {isStaffRole && staffData && (
                <div className="border-t pt-4">
                  <h3 className="mb-4 font-medium">Staff Details</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input value={staffData.first_name} onChange={(e) => setStaffData({ ...staffData, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Middle Name</Label>
                      <Input value={staffData.middle_name} onChange={(e) => setStaffData({ ...staffData, middle_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input value={staffData.last_name} onChange={(e) => setStaffData({ ...staffData, last_name: e.target.value })} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={staffData.gender} onValueChange={(value) => setStaffData({ ...staffData, gender: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input type="date" value={staffData.date_of_birth} onChange={(e) => setStaffData({ ...staffData, date_of_birth: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Qualification</Label>
                      <Input value={staffData.qualification} onChange={(e) => setStaffData({ ...staffData, qualification: e.target.value })} placeholder="e.g., B.Ed, M.Sc" />
                    </div>
                  </div>
                </div>
              )}

              {/* Student-specific fields - READ ONLY */}
              {isStudentRole && studentData && (
                <div className="border-t pt-4">
                  <h3 className="mb-4 font-medium">Student Details</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input value={studentData.first_name} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Middle Name</Label>
                      <Input value={studentData.middle_name || '—'} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input value={studentData.last_name} disabled className="bg-muted" />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Input value={studentData.gender === 'male' ? 'Male' : 'Female'} disabled className="bg-muted capitalize" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Birth</Label>
                      <Input value={studentData.date_of_birth || '—'} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Linked Parent</Label>
                      <Input value={studentData.parent_name || 'Not linked'} disabled className="bg-muted" />
                    </div>
                  </div>
                </div>
              )}

              {/* Parent-specific info */}
              {isParentRole && (
                <div className="border-t pt-4">
                  <h3 className="mb-4 font-medium">Parent/Guardian Details</h3>
                  <p className="text-sm text-muted-foreground">
                    You can manage your linked children from the Dashboard. Use the "Connect Child" feature to link students using their admission number.
                  </p>
                </div>
              )}

              {!isStudentRole && (
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Change Password</CardTitle>
              <CardDescription>Update your login password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Enter new password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleChangePassword} disabled={isChangingPassword}>
                  {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

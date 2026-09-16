import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Trash2, UserPlus, UserMinus, ArrowRightLeft, Copy, ImagePlus, X } from 'lucide-react';
import { useUpdateClassroom, useDeleteClassroom, useTransferClassroom, useCoTeachers, useAddCoTeacher, useRemoveCoTeacher } from '@/hooks/useClassroomManagement';
import { useSubjects } from '@/hooks/useSubjects';
import { useClassArms } from '@/hooks/useClassArms';
import { useStaff } from '@/hooks/useStaff';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface ClassroomSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: {
    id: string;
    name: string;
    code: string;
    description?: string;
    subject_id?: string;
    class_id?: string;
    banner_color?: string;
    banner_image_url?: string | null;
    teacher_id: string;
  };
}

export function ClassroomSettingsDialog({ open, onOpenChange, classroom }: ClassroomSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [name, setName] = useState(classroom.name);
  const [description, setDescription] = useState(classroom.description || '');
  const [subjectId, setSubjectId] = useState(classroom.subject_id || '');
  const [classId, setClassId] = useState(classroom.class_id || '');
  const [bannerColor, setBannerColor] = useState(classroom.banner_color || '#0B1F3B');
  const [bannerImageUrl, setBannerImageUrl] = useState(classroom.banner_image_url || '');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [selectedNewTeacher, setSelectedNewTeacher] = useState('');
  const [selectedCoTeacher, setSelectedCoTeacher] = useState('');

  const updateClassroom = useUpdateClassroom();
  const deleteClassroom = useDeleteClassroom();
  const transferClassroom = useTransferClassroom();
  const { data: subjects = [] } = useSubjects();
  const { data: classArms = [] } = useClassArms();
  const { data: staff = [] } = useStaff();
  const { data: coTeachers = [] } = useCoTeachers(classroom.id);
  const addCoTeacher = useAddCoTeacher();
  const removeCoTeacher = useRemoveCoTeacher();

  // Filter out the current owner and existing co-teachers
  // classroom.teacher_id is staff.id, so compare with s.id
  // ct.teacher_id is also staff.id
  const teachers = staff.filter((s: any) => 
    s.id !== classroom.teacher_id && 
    !coTeachers.some((ct: any) => ct.teacher_id === s.id)
  );

  const handleSaveGeneral = async () => {
    await updateClassroom.mutateAsync({
      id: classroom.id,
      name,
      description: description || undefined,
      subject_id: subjectId === 'none' ? undefined : subjectId,
      class_id: classId === 'none' ? undefined : classId,
      banner_color: bannerColor,
      banner_image_url: bannerImageUrl || null,
    });
  };

  // Uploads immediately on selection (same convention as Settings.tsx's
  // school-asset uploads) rather than waiting for the General tab's Save
  // button, since a preview only makes sense once the file is actually
  // stored somewhere fetchable.
  const handleBannerImageSelect = async (file: File) => {
    setUploadingBanner(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${classroom.id}/banner.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('classroom-assets')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('classroom-assets').getPublicUrl(path);
      const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      await updateClassroom.mutateAsync({ id: classroom.id, banner_image_url: bustedUrl });
      setBannerImageUrl(bustedUrl);
      toast.success('Banner image updated');
    } catch (err: any) {
      toast.error('Failed to upload banner image: ' + err.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleRemoveBannerImage = async () => {
    await updateClassroom.mutateAsync({ id: classroom.id, banner_image_url: null });
    setBannerImageUrl('');
  };

  const handleDelete = async () => {
    try {
      await deleteClassroom.mutateAsync(classroom.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
      window.location.href = '/classroom';
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleTransfer = async () => {
    if (!selectedNewTeacher) return;
    await transferClassroom.mutateAsync({
      classroomId: classroom.id,
      newTeacherId: selectedNewTeacher,
    });
    setShowTransferConfirm(false);
    onOpenChange(false);
  };

  const handleAddCoTeacher = async () => {
    if (!selectedCoTeacher) return;
    await addCoTeacher.mutateAsync({
      classroomId: classroom.id,
      teacherId: selectedCoTeacher,
    });
    setSelectedCoTeacher('');
  };

  const handleRemoveCoTeacher = async (teacherId: string) => {
    await removeCoTeacher.mutateAsync({
      classroomId: classroom.id,
      teacherId,
    });
  };

  const copyClassCode = () => {
    navigator.clipboard.writeText(classroom.code);
    toast.success('Class code copied to clipboard');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Classroom Settings</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
              <TabsTrigger value="teachers" className="flex-1">Teachers</TabsTrigger>
              <TabsTrigger value="danger" className="flex-1">Danger Zone</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              {/* Class Code */}
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm text-muted-foreground">Class Code</Label>
                    <p className="text-2xl font-mono font-bold">{classroom.code}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyClassCode}>
                    <Copy size={16} className="mr-2" />
                    Copy
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Classroom Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Mathematics SS2"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subject</Label>
                  <Select value={subjectId || 'none'} onValueChange={setSubjectId}>
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
                  <Label>Class</Label>
                  <Select value={classId || 'none'} onValueChange={setClassId}>
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
                {bannerImageUrl && (
                  <p className="text-xs text-muted-foreground mt-2">
                    A banner image is set below and takes priority over this color.
                  </p>
                )}
              </div>

              <div>
                <Label>Banner Image</Label>
                {bannerImageUrl ? (
                  <div className="mt-2 relative w-full h-24 rounded-lg overflow-hidden border">
                    <img src={bannerImageUrl} alt="Classroom banner" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      title="Remove banner image (use color instead)"
                      onClick={handleRemoveBannerImage}
                      disabled={updateClassroom.isPending}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <label className="mt-2 flex flex-col items-center justify-center gap-1 w-full h-24 rounded-lg border border-dashed cursor-pointer text-muted-foreground hover:bg-muted/50 transition-colors">
                    {uploadingBanner ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        <ImagePlus size={20} />
                        <span className="text-xs">Fill with picture instead</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingBanner}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBannerImageSelect(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>

              <DialogFooter>
                <Button 
                  onClick={handleSaveGeneral} 
                  disabled={!name.trim() || updateClassroom.isPending}
                >
                  {updateClassroom.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="teachers" className="space-y-4 mt-4">
              {/* Add Co-Teacher */}
              <div>
                <Label>Add Co-Teacher</Label>
                <div className="flex gap-2 mt-2">
                  <Select value={selectedCoTeacher} onValueChange={setSelectedCoTeacher}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.length === 0 ? (
                        <SelectItem value="none" disabled>No available teachers</SelectItem>
                      ) : (
                        teachers.map((teacher: any) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.first_name} {teacher.last_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddCoTeacher} 
                    disabled={!selectedCoTeacher || addCoTeacher.isPending}
                  >
                    {addCoTeacher.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  </Button>
                </div>
              </div>

              {/* Current Co-Teachers */}
              <div>
                <Label className="mb-2 block">Co-Teachers ({coTeachers.length})</Label>
                {coTeachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                    No co-teachers added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {coTeachers.map((ct: any) => (
                      <div key={ct.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={ct.staff?.avatar_url} />
                            <AvatarFallback>
                              {ct.staff?.first_name?.charAt(0)}{ct.staff?.last_name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {ct.staff?.first_name} {ct.staff?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{ct.staff?.email}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleRemoveCoTeacher(ct.teacher_id)}
                          disabled={removeCoTeacher.isPending}
                         title="Remove member">
                          <UserMinus size={16} className="text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="danger" className="space-y-4 mt-4">
              {/* Archive Classroom */}
              <div className="p-4 rounded-lg border border-secondary/50 bg-secondary/10">
                <div className="flex items-start gap-4">
                  <ArrowRightLeft className="h-5 w-5 text-secondary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">Archive Classroom</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Archive this classroom to hide it from active views. Content is preserved and can be restored later.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-3"
                      onClick={async () => {
                        try {
                          await updateClassroom.mutateAsync({ id: classroom.id, is_archived: true });
                          toast.success('Classroom archived');
                          onOpenChange(false);
                          window.location.href = '/classroom';
                        } catch (err: any) {
                          toast.error('Failed to archive: ' + err.message);
                        }
                      }}
                      disabled={updateClassroom.isPending}
                    >
                      {updateClassroom.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
                      Archive Classroom
                    </Button>
                  </div>
                </div>
              </div>

              {/* Transfer Ownership */}
              <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                <div className="flex items-start gap-4">
                  <ArrowRightLeft className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">Transfer Ownership</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Transfer this classroom to another teacher. You will lose ownership access.
                    </p>
                    <Button 
                      variant="outline" 
                      className="mt-3"
                      onClick={() => setShowTransferConfirm(true)}
                    >
                      Transfer Classroom
                    </Button>
                  </div>
                </div>
              </div>

              {/* Delete Classroom */}
              <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
                <div className="flex items-start gap-4">
                  <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">Delete Classroom</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permanently delete this classroom and all its content. This action cannot be undone.
                    </p>
                    <Button 
                      variant="destructive" 
                      className="mt-3"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete Classroom
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Classroom?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{classroom.name}" and all its content including posts, assignments, and materials. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClassroom.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Confirmation */}
      <AlertDialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Classroom Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              Select a teacher to transfer ownership of "{classroom.name}" to. You will lose owner privileges.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedNewTeacher} onValueChange={setSelectedNewTeacher}>
              <SelectTrigger>
                <SelectValue placeholder="Select new owner" />
              </SelectTrigger>
              <SelectContent>
                {staff
                  .filter((s: any) => s.id !== classroom.teacher_id)
                  .map((teacher: any) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.first_name} {teacher.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleTransfer}
              disabled={!selectedNewTeacher || transferClassroom.isPending}
            >
              {transferClassroom.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

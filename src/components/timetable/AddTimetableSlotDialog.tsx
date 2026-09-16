import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClassArms } from '@/hooks/useClassArms';
import { useSubjects } from '@/hooks/useSubjects';
import { useTeachers } from '@/hooks/useStaff';
import { useCreateTimetableSlot, useUpdateTimetableSlot, DAYS_OF_WEEK, TimetableSlotWithDetails } from '@/hooks/useTimetable';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface AddTimetableSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSlot?: TimetableSlotWithDetails | null;
  defaultClassId?: string;
  defaultDay?: number;
}

export function AddTimetableSlotDialog({
  open,
  onOpenChange,
  editSlot,
  defaultClassId,
  defaultDay,
}: AddTimetableSlotDialogProps) {
  const { data: classArms = [] } = useClassArms();
  const { data: subjects = [] } = useSubjects();
  const { data: teachers = [] } = useTeachers();
  const createSlot = useCreateTimetableSlot();
  const updateSlot = useUpdateTimetableSlot();

  const [formData, setFormData] = useState({
    class_id: defaultClassId || '',
    subject_id: '',
    teacher_id: '',
    day_of_week: defaultDay || 1,
    start_time: '08:00',
    end_time: '08:45',
    room_number: '',
  });

  useEffect(() => {
    if (editSlot) {
      setFormData({
        class_id: editSlot.class_id,
        subject_id: editSlot.subject_id,
        teacher_id: editSlot.teacher_id || '',
        day_of_week: editSlot.day_of_week,
        start_time: editSlot.start_time.slice(0, 5),
        end_time: editSlot.end_time.slice(0, 5),
        room_number: editSlot.room_number || '',
      });
    } else {
      setFormData({
        class_id: defaultClassId || '',
        subject_id: '',
        teacher_id: '',
        day_of_week: defaultDay || 1,
        start_time: '08:00',
        end_time: '08:45',
        room_number: '',
      });
    }
  }, [editSlot, defaultClassId, defaultDay, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.class_id || !formData.subject_id) {
      toast.error('Please select a class and subject');
      return;
    }

    try {
      const slotData = {
        class_id: formData.class_id,
        subject_id: formData.subject_id,
        teacher_id: formData.teacher_id || null,
        day_of_week: formData.day_of_week,
        start_time: formData.start_time,
        end_time: formData.end_time,
        room_number: formData.room_number || null,
      };

      if (editSlot) {
        await updateSlot.mutateAsync({ id: editSlot.id, ...slotData });
        toast.success('Timetable slot updated successfully');
      } else {
        await createSlot.mutateAsync(slotData);
        toast.success('Timetable slot added successfully');
      }

      onOpenChange(false);
    } catch (error: any) {
      if (error.message?.includes('unique_class_slot')) {
        toast.error('This time slot is already taken for this class');
      } else if (error.message?.includes('unique_teacher_slot')) {
        toast.error('This teacher already has a class at this time');
      } else {
        toast.error(error.message || 'Failed to save timetable slot');
      }
    }
  };

  const isLoading = createSlot.isPending || updateSlot.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editSlot ? 'Edit Timetable Slot' : 'Add Timetable Slot'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Class *</Label>
            <Select
              value={formData.class_id}
              onValueChange={(v) => setFormData({ ...formData, class_id: v })}
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
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Teacher</Label>
            <Select
              value={formData.teacher_id || 'none'}
              onValueChange={(v) => setFormData({ ...formData, teacher_id: v === 'none' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select teacher (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No teacher assigned</SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.first_name} {teacher.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Day *</Label>
            <Select
              value={formData.day_of_week.toString()}
              onValueChange={(v) => setFormData({ ...formData, day_of_week: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Room Number</Label>
            <Input
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              placeholder="e.g., Room 101"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editSlot ? 'Update Slot' : 'Add Slot'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

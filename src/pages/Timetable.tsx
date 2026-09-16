import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Calendar, 
  Download, 
  Printer,
  GraduationCap,
  User,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClassArms } from '@/hooks/useClassArms';
import { useTeachers } from '@/hooks/useStaff';
import { useMyStaffId } from '@/hooks/useMyStaffId';
import { useHasPermission } from '@/hooks/usePermissions';
import {
  useTimetableSlots, useTeacherTimetable, useDeleteTimetableSlot, DAYS_OF_WEEK, TIME_SLOTS,
  useMyTeachingClassIds, useMyStudentClassId,
} from '@/hooks/useTimetable';
import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { AddTimetableSlotDialog } from '@/components/timetable/AddTimetableSlotDialog';
import { TimetableSlotWithDetails } from '@/hooks/useTimetable';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Timetable() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  // Admin/principal always have it (useHasPermission ORs that in); a
  // school can additionally delegate full visibility (both tabs, every
  // class/teacher) to a specific staff member without making them a full
  // admin. Editing slots stays gated on isAdmin alone, further down —
  // this permission is view-only by design.
  const hasFullAccess = useHasPermission('view_all_timetables');

  const { data: classArms = [], isLoading: classesLoading } = useClassArms();
  const { data: teachers = [] } = useTeachers();
  const { data: myStaffId } = useMyStaffId();
  const { data: myTeachingClassIds = [] } = useMyTeachingClassIds(
    isTeacher && !hasFullAccess ? myStaffId ?? undefined : undefined
  );
  const { data: myStudentClassId } = useMyStudentClassId();

  // A teacher without the full-access grant only ever sees the classes
  // they actually teach (per their own timetable_slots rows); everyone
  // with full access sees every class in the school.
  const visibleClassArms = hasFullAccess || !isTeacher
    ? classArms
    : classArms.filter((c) => myTeachingClassIds.includes(c.id));

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<TimetableSlotWithDetails | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<TimetableSlotWithDetails | null>(null);
  const [defaultDay, setDefaultDay] = useState<number>(1);
  const [defaultStartTime, setDefaultStartTime] = useState<string>('08:00');

  // A student only ever sees their own class's timetable — no selector,
  // no By Teacher tab at all. Lock the class selection to it as soon as
  // it's known.
  useEffect(() => {
    if (isStudent && myStudentClassId) {
      setSelectedClassId(myStudentClassId);
      setViewMode('class');
    }
  }, [isStudent, myStudentClassId]);

  const { data: classSlots = [], isLoading: classSlotsLoading } = useTimetableSlots(
    viewMode === 'class' ? selectedClassId : undefined
  );
  const { data: teacherSlots = [], isLoading: teacherSlotsLoading } = useTeacherTimetable(
    viewMode === 'teacher' ? selectedTeacherId : undefined
  );

  const deleteSlotMutation = useDeleteTimetableSlot();

  const currentSlots = viewMode === 'class' ? classSlots : teacherSlots;
  const isLoading = viewMode === 'class' ? classSlotsLoading : teacherSlotsLoading;

  const handleAddSlot = (day: number, startTime: string) => {
    setDefaultDay(day);
    setDefaultStartTime(startTime);
    setEditSlot(null);
    setAddDialogOpen(true);
  };

  const handleEditSlot = (slot: TimetableSlotWithDetails) => {
    setEditSlot(slot);
    setAddDialogOpen(true);
  };

  const handleDeleteSlot = async () => {
    if (!deleteSlot) return;
    
    try {
      await deleteSlotMutation.mutateAsync(deleteSlot.id);
      toast.success('Timetable slot deleted successfully');
      setDeleteSlot(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete slot');
    }
  };

  const handlePrint = () => {
    // A plain HTML <table> in its own popup window (same approach already
    // used for ID cards) instead of window.print() on the live page —
    // printing in place would also try to fit the sidebar/nav chrome and
    // the on-screen card-grid layout, which doesn't reliably page-break
    // or scale down to one page. A dedicated landscape, single-page table
    // is much more print-reliable for genuinely tabular data like this.
    const title = viewMode === 'class'
      ? (visibleClassArms.find(c => c.id === selectedClassId)
          ? `${visibleClassArms.find(c => c.id === selectedClassId)!.name} ${visibleClassArms.find(c => c.id === selectedClassId)!.arm}`
          : 'Class Timetable')
      : (teachers.find(t => t.id === selectedTeacherId)
          ? `${teachers.find(t => t.id === selectedTeacherId)!.first_name} ${teachers.find(t => t.id === selectedTeacherId)!.last_name}`
          : 'Teacher Timetable');

    const formatTimeForPrint = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    const printTimeSlots = TIME_SLOTS.filter(
      (slot) => !slot.label.includes('Break') && !slot.label.includes('Lunch')
    );
    const slotsByDayTime = new Map<string, TimetableSlotWithDetails>();
    currentSlots.forEach((slot) => {
      slotsByDayTime.set(`${slot.day_of_week}-${slot.start_time.slice(0, 5)}`, slot);
    });

    const rows = printTimeSlots.map((timeSlot) => {
      const cells = DAYS_OF_WEEK.map((day) => {
        const slot = slotsByDayTime.get(`${day.value}-${timeSlot.start}`);
        if (!slot) return '<td class="empty"></td>';
        const subLine = viewMode === 'class'
          ? (slot.staff ? `${slot.staff.first_name} ${slot.staff.last_name}` : 'No teacher')
          : (slot.class_arms ? `${slot.class_arms.name} ${slot.class_arms.arm}` : '');
        return `<td><div class="subject">${slot.subjects?.name ?? ''}</div><div class="sub">${subLine}${slot.room_number ? ` · ${slot.room_number}` : ''}</div></td>`;
      }).join('');
      return `<tr><td class="time">${formatTimeForPrint(timeSlot.start)}<br/>${formatTimeForPrint(timeSlot.end)}</td>${cells}</tr>`;
    }).join('');

    const headerCells = DAYS_OF_WEEK.map((d) => `<th>${d.label}</th>`).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Timetable — ${title}</title>
      <style>
        @page { size: landscape; margin: 1cm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 12px; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        .subtitle { font-size: 11px; color: #666; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; font-size: 11px; text-align: center; }
        td.time { font-size: 10px; color: #666; white-space: nowrap; width: 70px; text-align: center; }
        td.empty { background: #fafafa; }
        .subject { font-size: 11px; font-weight: 600; }
        .sub { font-size: 9px; color: #666; margin-top: 1px; }
        @media print { html, body { height: 100%; } table { font-size: 10px; } }
      </style></head>
      <body>
        <h1>Timetable — ${title}</h1>
        <p class="subtitle">${viewMode === 'class' ? 'By Class' : 'By Teacher'} · Generated ${new Date().toLocaleDateString()}</p>
        <table><thead><tr><th></th>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
        <script>window.print(); window.close();<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  // Calculate stats
  const totalPeriods = currentSlots.length;
  const uniqueSubjects = new Set(currentSlots.map(s => s.subject_id)).size;
  const uniqueTeachers = new Set(currentSlots.filter(s => s.teacher_id).map(s => s.teacher_id)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timetable</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage class schedules and teacher assignments' : 'View your class schedule'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {isAdmin && (
            <Button 
              onClick={() => {
                setEditSlot(null);
                setAddDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus size={18} />
              Add Slot
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Periods</p>
              <p className="text-2xl font-bold">{totalPeriods}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
              <GraduationCap className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subjects</p>
              <p className="text-2xl font-bold">{uniqueSubjects}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <User className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Teachers</p>
              <p className="text-2xl font-bold">{uniqueTeachers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'class' | 'teacher')}>
              <TabsList>
                <TabsTrigger value="class" className="gap-2">
                  <GraduationCap className="h-4 w-4" />
                  By Class
                </TabsTrigger>
                {hasFullAccess && (
                  <TabsTrigger value="teacher" className="gap-2">
                    <User className="h-4 w-4" />
                    By Teacher
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            <div className="flex gap-3">
              {isStudent ? null : viewMode === 'class' ? (
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleClassArms.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} {cls.arm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedClassId && viewMode === 'class' && !isStudent && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Select a Class</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a class from the dropdown to view its timetable
              </p>
            </div>
          )}

          {!selectedClassId && viewMode === 'class' && isStudent && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {!selectedTeacherId && viewMode === 'teacher' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Select a Teacher</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a teacher from the dropdown to view their schedule
              </p>
            </div>
          )}

          {isLoading && (selectedClassId || selectedTeacherId) && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {!isLoading && ((viewMode === 'class' && selectedClassId) || (viewMode === 'teacher' && selectedTeacherId)) && (
            <>
              {currentSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No Schedule Found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isAdmin ? 'Click "Add Slot" or click on empty cells to add periods' : 'No timetable has been set up yet'}
                  </p>
                </div>
              ) : (
                <TimetableGrid
                  slots={currentSlots}
                  onEdit={isAdmin ? handleEditSlot : undefined}
                  onDelete={isAdmin ? setDeleteSlot : undefined}
                  onAddSlot={isAdmin ? handleAddSlot : undefined}
                  isEditable={isAdmin}
                  showTeacher={viewMode === 'class'}
                  showClass={viewMode === 'teacher'}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <AddTimetableSlotDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        editSlot={editSlot}
        defaultClassId={viewMode === 'class' ? selectedClassId : undefined}
        defaultDay={defaultDay}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSlot} onOpenChange={() => setDeleteSlot(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timetable Slot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this slot? This will remove{' '}
              <strong>{deleteSlot?.subjects?.name}</strong> on{' '}
              <strong>{DAYS_OF_WEEK.find(d => d.value === deleteSlot?.day_of_week)?.label}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSlot}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import {
  useStudentsForAttendance, useMarkAttendance, useAttendanceByDate,
  useAttendanceSession, useUnlockAttendanceSession,
} from '@/hooks/useAttendance';
import { useClassArms } from '@/hooks/useClassArms';
import { useMyTeachingScope } from '@/hooks/useMyTeachingScope';
import { useParentChildren } from '@/hooks/useParentChildren';
import { CheckCircle2, XCircle, Clock, AlertCircle, QrCode, Save, Loader2, Lock, LockOpen, BarChart3, ClipboardList } from 'lucide-react';
import { QRAttendanceScanner } from '@/components/attendance/QRAttendanceScanner';
import { AttendanceAnalytics } from '@/components/attendance/AttendanceAnalytics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

type AttendanceStatus = Database['public']['Enums']['attendance_status'];

function ParentAttendanceView() {
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const today = new Date().toISOString().split('T')[0];

  // Fetch attendance for all linked children
  const { data: attendanceRecords = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['parent-children-attendance', children.map(c => c.id)],
    queryFn: async () => {
      if (children.length === 0) return [];
      const childIds = children.map(c => c.id);
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .in('student_id', childIds)
        .order('date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: children.length > 0,
  });

  const statusConfig = {
    present: { icon: CheckCircle2, color: 'text-success bg-success/10', label: 'Present' },
    absent: { icon: XCircle, color: 'text-destructive bg-destructive/10', label: 'Absent' },
    late: { icon: Clock, color: 'text-accent-foreground bg-accent/20', label: 'Late' },
    excused: { icon: AlertCircle, color: 'text-secondary bg-secondary/10', label: 'Excused' },
  };

  if (childrenLoading || attendanceLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No children linked to your account</p>
          <p className="text-sm text-muted-foreground/70">Connect a child from your dashboard to view their attendance</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {children.map((child) => {
        const childRecords = attendanceRecords.filter(r => r.student_id === child.id);
        const recentRecords = childRecords.slice(0, 20);
        const totalRecords = childRecords.length;
        const presentCount = childRecords.filter(r => r.status === 'present').length;
        const absentCount = childRecords.filter(r => r.status === 'absent').length;
        const lateCount = childRecords.filter(r => r.status === 'late').length;

        return (
          <Card key={child.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={child.avatar_url || undefined} />
                  <AvatarFallback>{child.first_name.charAt(0)}{child.last_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">{child.first_name} {child.last_name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {child.admission_number} • {child.class_arms ? `${child.class_arms.name} ${child.class_arms.arm}` : 'No class'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center rounded-lg bg-success/10 p-2">
                  <p className="text-lg font-bold text-success">{presentCount}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div className="text-center rounded-lg bg-destructive/10 p-2">
                  <p className="text-lg font-bold text-destructive">{absentCount}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
                <div className="text-center rounded-lg bg-accent/20 p-2">
                  <p className="text-lg font-bold text-accent-foreground">{lateCount}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
                <div className="text-center rounded-lg bg-muted p-2">
                  <p className="text-lg font-bold text-foreground">{totalRecords}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>

              {/* Recent records */}
              {recentRecords.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Recent Records</p>
                  {recentRecords.map((record) => {
                    const config = statusConfig[record.status as AttendanceStatus];
                    return (
                      <div key={record.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <span className="text-sm font-medium">
                          {new Date(record.date).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-4 text-muted-foreground text-sm">No attendance records yet</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';

  // For staff view
  const { data: allClassArms = [] } = useClassArms();
  const { data: teachingScope, isTeacher: isTeacherRole } = useMyTeachingScope();
  // Non-admin teachers only see classes they're the form teacher of — matching
  // the "form-teacher-only attendance access/marking" RLS scoping. Admins and
  // principals keep the full school-wide list.
  const classArms = isTeacherRole
    ? allClassArms.filter((c) => teachingScope.isFormTeacherOf(c.id))
    : allClassArms;
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const { data: students = [], isLoading } = useStudentsForAttendance(selectedClassId || undefined);
  const { data: existingRecords = [] } = useAttendanceByDate(selectedDate, selectedClassId || undefined);
  const { data: session } = useAttendanceSession(selectedClassId || undefined, selectedDate);
  const markAttendance = useMarkAttendance();
  const unlockSession = useUnlockAttendanceSession();

  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  // Form teachers can also mark attendance
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'mark' | 'analytics'>('mark');
  const today = new Date().toISOString().split('T')[0];

  const isLocked = session?.status === 'submitted' || session?.status === 'locked';
  // Teachers can't edit a locked session; admins can always edit (RLS
  // backs this too — this just keeps the UI from offering a save that
  // would fail).
  const canEdit = !isLocked || isAdmin;

  // Pre-populate the grid with whatever's already saved for this
  // class/date, so reopening the page doesn't show everyone as
  // unmarked and re-saving doesn't lose prior selections.
  useEffect(() => {
    const initial: Record<string, AttendanceStatus> = {};
    existingRecords.forEach((r) => {
      if (r.student_id) initial[r.student_id] = r.status as AttendanceStatus;
    });
    setAttendance(initial);
  }, [existingRecords]);

  const statusConfig = {
    present: { icon: CheckCircle2, color: 'text-success bg-success/10', label: 'Present' },
    absent: { icon: XCircle, color: 'text-destructive bg-destructive/10', label: 'Absent' },
    late: { icon: Clock, color: 'text-accent-foreground bg-accent/20', label: 'Late' },
    excused: { icon: AlertCircle, color: 'text-secondary bg-secondary/10', label: 'Excused' },
  };

  const stats = useMemo(() => ({
    present: Object.values(attendance).filter(s => s === 'present').length,
    absent: Object.values(attendance).filter(s => s === 'absent').length,
    late: Object.values(attendance).filter(s => s === 'late').length,
    excused: Object.values(attendance).filter(s => s === 'excused').length,
  }), [attendance]);

  const handleSaveAttendance = async () => {
    if (!selectedClassId) {
      toast.error('Please select a class first');
      return;
    }
    const records = Object.entries(attendance).map(([studentId, status]) => ({
      student_id: studentId,
      status,
    }));

    if (records.length === 0) {
      toast.error('Please mark attendance for at least one student');
      return;
    }

    try {
      await markAttendance.mutateAsync({ classId: selectedClassId, date: selectedDate, records });
      toast.success(
        isAdmin ? 'Attendance saved successfully!' : 'Attendance saved and locked. An Admin/Principal can unlock it for corrections.'
      );
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save attendance');
    }
  };

  const handleUnlock = async () => {
    if (!session) return;
    try {
      await unlockSession.mutateAsync(session.id);
      toast.success('Attendance unlocked — the teacher can now make corrections and re-save.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to unlock attendance');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {isTeacher && !isParent && (
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setViewMode('mark')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewMode === 'mark' ? 'border-secondary text-secondary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <ClipboardList size={16} /> Mark Attendance
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewMode === 'analytics' ? 'border-secondary text-secondary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <BarChart3 size={16} /> Analytics
          </button>
        </div>
      )}

      {viewMode === 'analytics' && isTeacher && !isParent ? (
        <AttendanceAnalytics />
      ) : (
      <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">Attendance</h1>
          <p className="text-muted-foreground mt-1">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {isTeacher && !isParent && (
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setQrScannerOpen(true)}>
              <QrCode size={18} />
              QR Scan
            </Button>
            <Button
              className="btn-teal gap-2"
              onClick={handleSaveAttendance}
              disabled={markAttendance.isPending || !canEdit}
              title={!canEdit ? 'This session is locked — ask an Admin/Principal to unlock it' : undefined}
            >
              {markAttendance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={18} />}
              Save
            </Button>
          </div>
        )}
      </div>

      {isTeacher && !isParent && isLocked && (
        <Alert variant={isAdmin ? 'default' : 'destructive'}>
          <Lock className="h-4 w-4" />
          <AlertTitle>Attendance locked</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span>
              This attendance was submitted{session?.submitted_at ? ` on ${new Date(session.submitted_at).toLocaleString('en-NG')}` : ''} and can no longer be edited by teachers.
              {isAdmin ? ' As Admin/Principal, you can still edit directly, or unlock it so the teacher can correct it themselves.' : ' Contact an Admin/Principal to unlock it.'}
            </span>
            {isAdmin && (
              <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={handleUnlock} disabled={unlockSession.isPending}>
                {unlockSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                Unlock
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isParent ? (
        <ParentAttendanceView />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {Object.entries(stats).map(([key, value]) => {
              const config = statusConfig[key as AttendanceStatus];
              return (
                <Card key={key}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`rounded-xl p-3 ${config.color}`}>
                      <config.icon size={24} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{value}</p>
                      <p className="text-sm text-muted-foreground">{config.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CardTitle className="font-display">Mark Attendance</CardTitle>
                {selectedClassId && isLocked && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                    <Lock className="h-3 w-3" /> Locked
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-[160px]"
                />
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Class" />
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
            </CardHeader>
            <CardContent>
              {isTeacherRole && classArms.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  You're not currently set as the form teacher of any class. Contact an Admin/Principal to be assigned one.
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-secondary" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {selectedClassId 
                    ? 'No active students in this class' 
                    : 'Select a class to mark attendance'}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-4 rounded-xl border border-border">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback>
                            {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium text-foreground">
                            {student.first_name} {student.last_name}
                          </span>
                          <p className="text-xs text-muted-foreground">{student.admission_number}</p>
                        </div>
                      </div>
                      {isTeacher && canEdit ? (
                        <div className="flex gap-1">
                          {(['present', 'absent', 'late', 'excused'] as const).map((status) => {
                            const config = statusConfig[status];
                            const isActive = attendance[student.id] === status;
                            return (
                              <button 
                                key={status} 
                                onClick={() => setAttendance(prev => ({ ...prev, [student.id]: status }))} 
                                className={`p-2 rounded-lg transition-all ${isActive ? config.color : 'text-muted-foreground hover:bg-muted'}`} 
                                title={config.label}
                              >
                                <config.icon size={18} />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        attendance[student.id] && (
                          <span className={`px-2 py-1 rounded text-sm ${statusConfig[attendance[student.id]].color}`}>
                            {statusConfig[attendance[student.id]].label}
                          </span>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* QR Scanner Dialog */}
      <QRAttendanceScanner open={qrScannerOpen} onOpenChange={setQrScannerOpen} />
      </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronUp, Users, UserCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClassArms } from '@/hooks/useClassArms';
import { useMyTeachingScope } from '@/hooks/useMyTeachingScope';
import {
  useStudentAttendanceAnalytics, useStaffAttendanceAnalytics,
  useStudentAttendanceDrilldown, useStaffAttendanceDrilldown,
  formatMinutesAsTime, type AttendanceStatus,
} from '@/hooks/useAttendanceAnalytics';

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'hsl(145, 63%, 49%)',
  late: 'hsl(46, 90%, 57%)',
  absent: 'hsl(6, 74%, 57%)',
  excused: 'hsl(213, 75%, 14%)',
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function AttendanceAnalytics() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const isTeacherRole = user?.role === 'teacher';

  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  const { data: allClasses = [] } = useClassArms();
  const { data: teachingScope } = useMyTeachingScope();
  const classes = isTeacherRole
    ? allClasses.filter((c) => teachingScope.accessibleClassIds.has(c.id))
    : allClasses;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students" className="gap-2"><Users size={16} /> Students</TabsTrigger>
            <TabsTrigger value="staff" className="gap-2"><UserCog size={16} /> Staff</TabsTrigger>
          </TabsList>
          <TabsContent value="students" className="mt-4">
            <StudentAnalyticsSection from={from} to={to} classId={selectedClassId === 'all' ? null : selectedClassId} />
          </TabsContent>
          <TabsContent value="staff" className="mt-4">
            <StaffAnalyticsSection from={from} to={to} />
          </TabsContent>
        </Tabs>
      ) : (
        <StudentAnalyticsSection from={from} to={to} classId={selectedClassId === 'all' ? null : selectedClassId} />
      )}
    </div>
  );
}

function StudentAnalyticsSection({ from, to, classId }: { from: string; to: string; classId: string | null }) {
  const { data, isLoading } = useStudentAttendanceAnalytics({ from, to, classId });
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  const statusEntries = data
    ? (Object.entries(data.byStatus) as [AttendanceStatus, number][]).filter(([, v]) => v > 0)
    : [];
  const total = data?.totalRecords || 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((status) => {
          const count = data?.byStatus[status] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <Card key={status}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground capitalize">{status}</p>
                <p className="text-2xl font-bold" style={{ color: STATUS_COLORS[status] }}>{pct}%</p>
                <p className="text-xs text-muted-foreground">{count} records</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Attendance Trend</CardTitle></CardHeader>
          <CardContent>
            {data && data.byDate.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.byDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke={STATUS_COLORS.present} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="late" stroke={STATUS_COLORS.late} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="absent" stroke={STATUS_COLORS.absent} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="excused" stroke={STATUS_COLORS.excused} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">No data for this range</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            {statusEntries.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusEntries.map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value">
                    {statusEntries.map(([status]) => <Cell key={status} fill={STATUS_COLORS[status]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-muted-foreground text-sm">No data for this range</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">By Student</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!data || data.byStudent.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No students with attendance records in this range</div>
          ) : (
            <div className="divide-y divide-border">
              {data.byStudent.map((s) => (
                <div key={s.id}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedStudentId(expandedStudentId === s.id ? null : s.id)}
                  >
                    <div>
                      <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.admission_number}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map((st) => (
                        s.counts[st] > 0 && (
                          <Badge key={st} variant="outline" className="text-xs" style={{ color: STATUS_COLORS[st], borderColor: STATUS_COLORS[st] }}>
                            {st[0].toUpperCase()}: {s.counts[st]}
                          </Badge>
                        )
                      ))}
                      {expandedStudentId === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {expandedStudentId === s.id && (
                    <StudentDrilldown studentId={s.id} from={from} to={to} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StudentDrilldown({ studentId, from, to }: { studentId: string; from: string; to: string }) {
  const { data, isLoading } = useStudentAttendanceDrilldown(studentId, from, to);
  if (isLoading) return <div className="px-4 pb-3"><Skeleton className="h-20 w-full" /></div>;
  if (!data || data.length === 0) return null;
  return (
    <div className="px-4 pb-3 bg-muted/30">
      <div className="flex flex-wrap gap-2 pt-2">
        {data.map((r, i) => (
          <Badge key={i} variant="secondary" className="text-xs font-normal" style={{ color: STATUS_COLORS[r.status as AttendanceStatus] }}>
            {r.date} — {r.status}{r.period ? ` (P${r.period})` : ''}{r.method === 'qr' ? ' · QR' : ''}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function StaffAnalyticsSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useStaffAttendanceAnalytics({ from, to });
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Clock-Ins</p>
            <p className="text-2xl font-bold text-secondary">{data?.totalRecords || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Staff Tracked</p>
            <p className="text-2xl font-bold text-secondary">{data?.byStaff.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg. Clock-In Time</p>
            <p className="text-2xl font-bold text-secondary">
              {formatMinutesAsTime(
                data && data.byStaff.length > 0
                  ? Math.round(
                      data.byStaff.filter(s => s.avgClockInMinutesPastMidnight !== null)
                        .reduce((sum, s) => sum + (s.avgClockInMinutesPastMidnight || 0), 0)
                      / (data.byStaff.filter(s => s.avgClockInMinutesPastMidnight !== null).length || 1)
                    )
                  : null
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daily Clock-Ins</CardTitle></CardHeader>
        <CardContent>
          {data && data.byDate.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.byDate}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="clockIns" fill="hsl(181, 69%, 39%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">No data for this range</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">By Staff Member</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!data || data.byStaff.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No clock records in this range</div>
          ) : (
            <div className="divide-y divide-border">
              {data.byStaff.map((s) => (
                <div key={s.id}>
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedStaffId(expandedStaffId === s.id ? null : s.id)}
                  >
                    <div>
                      <p className="font-medium text-sm">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.employee_id}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{s.daysClocked} day{s.daysClocked !== 1 ? 's' : ''}</span>
                      <span>{s.totalHours}h logged</span>
                      <span>avg in: {formatMinutesAsTime(s.avgClockInMinutesPastMidnight)}</span>
                      {expandedStaffId === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  {expandedStaffId === s.id && (
                    <StaffDrilldown staffId={s.id} from={from} to={to} />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StaffDrilldown({ staffId, from, to }: { staffId: string; from: string; to: string }) {
  const { data, isLoading } = useStaffAttendanceDrilldown(staffId, from, to);
  if (isLoading) return <div className="px-4 pb-3"><Skeleton className="h-20 w-full" /></div>;
  if (!data || data.length === 0) return null;
  return (
    <div className="px-4 pb-3 bg-muted/30">
      <div className="flex flex-col gap-1 pt-2">
        {data.map((r, i) => (
          <div key={i} className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="font-medium text-foreground">{r.date}</span>
            <span>In: {r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            <span>Out: {r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
            {r.method && <span className="capitalize">({r.method.replace('_', ' ')})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

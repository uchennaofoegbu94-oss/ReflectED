import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Users, GraduationCap, ClipboardCheck, CreditCard, TrendingUp,
  BookOpen, FileText, BarChart3, Calendar, Award,
} from 'lucide-react';

const COLORS = [
  'hsl(181, 69%, 39%)',
  'hsl(46, 90%, 57%)',
  'hsl(213, 75%, 14%)',
  'hsl(145, 63%, 49%)',
  'hsl(6, 74%, 57%)',
  'hsl(280, 60%, 50%)',
];

function useAnalyticsData() {
  return useQuery({
    queryKey: ['analytics-data'],
    queryFn: async () => {
      const [
        studentsResult,
        staffResult,
        classArmsResult,
        subjectsResult,
        attendanceResult,
        paymentsResult,
        submissionsResult,
        classroomsResult,
        eventsResult,
        studentFeesResult,
      ] = await Promise.all([
        supabase.from('students').select('id, gender, enrollment_status, class_id, created_at, class_arms(name, level)'),
        supabase.from('staff').select('id, gender, employment_status, created_at'),
        supabase.from('class_arms').select('id, name, level'),
        supabase.from('subjects').select('id, name'),
        supabase.from('attendance_records').select('id, status, date, student_id'),
        supabase.from('payments').select('id, amount, status, payment_date, method, created_at, student_id'),
        supabase.from('submissions').select('id, status, is_late, submitted_at, grade'),
        supabase.from('classrooms').select('id, name, is_archived'),
        supabase.from('events').select('id, type, is_active'),
        supabase.from('student_fees').select('student_id, custom_amount, waived, fee_structures (amount)'),
      ]);

      return {
        students: studentsResult.data || [],
        staff: staffResult.data || [],
        classArms: classArmsResult.data || [],
        subjects: subjectsResult.data || [],
        attendance: attendanceResult.data || [],
        payments: paymentsResult.data || [],
        submissions: submissionsResult.data || [],
        classrooms: classroomsResult.data || [],
        events: eventsResult.data || [],
        studentFees: studentFeesResult.data || [],
      };
    },
  });
}

export default function Analytics() {
  const { user } = useAuth();
  const isAccountant = user?.role === 'accountant';
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsData();

  const isLoading = statsLoading || analyticsLoading;

  // Derived data
  const genderDistribution = analyticsData ? [
    { name: 'Male', value: analyticsData.students.filter((s: any) => s.gender === 'male').length },
    { name: 'Female', value: analyticsData.students.filter((s: any) => s.gender === 'female').length },
  ] : [];

  const enrollmentStatusData = analyticsData ? [
    { name: 'Active', value: analyticsData.students.filter((s: any) => s.enrollment_status === 'active').length },
    { name: 'Graduated', value: analyticsData.students.filter((s: any) => s.enrollment_status === 'graduated').length },
    { name: 'Transferred', value: analyticsData.students.filter((s: any) => s.enrollment_status === 'transferred').length },
    { name: 'Suspended', value: analyticsData.students.filter((s: any) => s.enrollment_status === 'suspended').length },
  ].filter(d => d.value > 0) : [];

  const levelDistribution = analyticsData ? (() => {
    const levels: Record<string, number> = {};
    analyticsData.classArms.forEach((c: any) => {
      const label = c.level === 'primary' ? 'Primary' : c.level === 'junior-secondary' ? 'Junior Sec.' : 'Senior Sec.';
      levels[label] = (levels[label] || 0) + analyticsData.students.filter((s: any) => s.class_id === c.id).length;
    });
    return Object.entries(levels).map(([name, value]) => ({ name, value }));
  })() : [];

  const attendanceBreakdown = analyticsData ? [
    { name: 'Present', value: analyticsData.attendance.filter((a: any) => a.status === 'present').length },
    { name: 'Absent', value: analyticsData.attendance.filter((a: any) => a.status === 'absent').length },
    { name: 'Late', value: analyticsData.attendance.filter((a: any) => a.status === 'late').length },
    { name: 'Excused', value: analyticsData.attendance.filter((a: any) => a.status === 'excused').length },
  ].filter(d => d.value > 0) : [];

  const paymentMethodData = analyticsData ? (() => {
    const methods: Record<string, number> = {};
    analyticsData.payments.filter((p: any) => p.status === 'confirmed').forEach((p: any) => {
      const label = p.method === 'bank_transfer' ? 'Bank Transfer' : p.method === 'pos' ? 'POS' : 'Cash';
      methods[label] = (methods[label] || 0) + Number(p.amount);
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  })() : [];

  const submissionStats = analyticsData ? [
    { name: 'Submitted', value: analyticsData.submissions.filter((s: any) => s.status === 'submitted').length },
    { name: 'Graded', value: analyticsData.submissions.filter((s: any) => s.status === 'graded').length },
    { name: 'Returned', value: analyticsData.submissions.filter((s: any) => s.status === 'returned').length },
  ].filter(d => d.value > 0) : [];

  const lateSubmissions = analyticsData
    ? analyticsData.submissions.filter((s: any) => s.is_late).length
    : 0;
  const totalSubmissions = analyticsData ? analyticsData.submissions.length : 0;

  // Monthly enrollment trend (last 6 months)
  const enrollmentTrend = analyticsData ? (() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months[key] = 0;
    }
    analyticsData.students.forEach((s: any) => {
      const d = new Date(s.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (months[key] !== undefined) months[key]++;
    });
    return Object.entries(months).map(([month, count]) => ({ month, enrollments: count }));
  })() : [];

  // Revenue trend (last 6 months)
  const revenueTrend = analyticsData ? (() => {
    const months: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      months[key] = 0;
    }
    analyticsData.payments.filter((p: any) => p.status === 'confirmed').forEach((p: any) => {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (months[key] !== undefined) months[key] += Number(p.amount);
    });
    return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
  })() : [];

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}K`;
    return `₦${amount.toLocaleString()}`;
  };

  const totalRevenue = analyticsData
    ? analyticsData.payments.filter((p: any) => p.status === 'confirmed').reduce((sum: number, p: any) => sum + Number(p.amount), 0)
    : 0;

  // Accountant-specific: per-student owed vs. paid, to get an outstanding
  // total and a paid/partial/unpaid breakdown — same effective-balance
  // logic as useStudentFeeBalances/useChildDashboardStats, computed here
  // from the already-fetched studentFees + payments instead of an extra
  // round trip.
  const feeStatusBreakdown = analyticsData ? (() => {
    const owedByStudent: Record<string, number> = {};
    (analyticsData.studentFees as any[]).forEach((line) => {
      if (line.waived) return;
      const amount = line.custom_amount ?? line.fee_structures?.amount ?? 0;
      owedByStudent[line.student_id] = (owedByStudent[line.student_id] || 0) + amount;
    });
    const paidByStudent: Record<string, number> = {};
    analyticsData.payments.filter((p: any) => p.status === 'confirmed').forEach((p: any) => {
      if (!p.student_id) return;
      paidByStudent[p.student_id] = (paidByStudent[p.student_id] || 0) + Number(p.amount);
    });

    let fullyPaid = 0, partiallyPaid = 0, unpaid = 0, outstandingTotal = 0;
    Object.entries(owedByStudent).forEach(([studentId, owed]) => {
      const paid = paidByStudent[studentId] || 0;
      const balance = Math.max(owed - paid, 0);
      outstandingTotal += balance;
      if (balance <= 0) fullyPaid++;
      else if (paid > 0) partiallyPaid++;
      else unpaid++;
    });

    return {
      outstandingTotal,
      chartData: [
        { name: 'Fully Paid', value: fullyPaid },
        { name: 'Partially Paid', value: partiallyPaid },
        { name: 'Unpaid', value: unpaid },
      ].filter(d => d.value > 0),
    };
  })() : { outstandingTotal: 0, chartData: [] as { name: string; value: number }[] };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          {isAccountant ? 'Financial overview and fee collection performance' : 'Comprehensive overview of school performance and data'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : isAccountant ? (
          <>
            <SummaryCard icon={CreditCard} label="Revenue Collected" value={formatCurrency(totalRevenue)} color="text-accent-foreground" />
            <SummaryCard icon={CreditCard} label="Outstanding Fees" value={formatCurrency(feeStatusBreakdown.outstandingTotal)} color="text-destructive" />
            <SummaryCard icon={Users} label="Total Students" value={stats?.totalStudents || 0} color="text-primary" />
            <SummaryCard icon={Award} label="Confirmed Payments" value={analyticsData?.payments.filter((p: any) => p.status === 'confirmed').length || 0} color="text-success" />
            <SummaryCard icon={GraduationCap} label="Active Classes" value={analyticsData?.classArms.length || 0} color="text-secondary" />
          </>
        ) : (
          <>
            <SummaryCard icon={Users} label="Total Students" value={stats?.totalStudents || 0} color="text-primary" />
            <SummaryCard icon={GraduationCap} label="Total Staff" value={stats?.totalTeachers || 0} color="text-secondary" />
            <SummaryCard icon={ClipboardCheck} label="Attendance Rate" value={`${stats?.attendanceRate || 0}%`} color="text-success" />
            <SummaryCard icon={CreditCard} label="Revenue" value={formatCurrency(totalRevenue)} color="text-accent-foreground" />
            <SummaryCard icon={BookOpen} label="Classrooms" value={analyticsData?.classrooms.filter((c: any) => !c.is_archived).length || 0} color="text-primary" />
          </>
        )}
      </div>

      {/* Row 1: Enrollment Trend + Gender — not relevant to an accountant's job */}
      {!isAccountant && (
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Student Enrollment Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px]" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={enrollmentTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Area type="monotone" dataKey="enrollments" stroke="hsl(181, 69%, 39%)" fill="hsl(181, 69%, 39%)" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px]" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={genderDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={5} dataKey="value">
                    {genderDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Row 2: Revenue Trend + Payment Methods */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px]" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="revenue" fill="hsl(46, 90%, 57%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[280px]" /> : paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={paymentMethodData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {paymentMethodData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">No payment data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accountant-only: fee payment status breakdown */}
      {isAccountant && (
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fee Payment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[220px]" /> : feeStatusBreakdown.chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={feeStatusBreakdown.chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="value" fill="hsl(181, 69%, 39%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[220px] items-center justify-center text-muted-foreground text-sm">No fee assignments yet</div>
            )}
          </CardContent>
        </Card>
        <SummaryCard icon={CreditCard} label="Total Outstanding" value={formatCurrency(feeStatusBreakdown.outstandingTotal)} color="text-destructive" />
      </div>
      )}

      {/* Row 3: Attendance + Submissions + Enrollment Status — not relevant to an accountant's job */}
      {!isAccountant && (
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[240px]" /> : attendanceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={attendanceBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {attendanceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">No attendance data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submission Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[240px]" /> : submissionStats.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={submissionStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={70} className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="value" fill="hsl(213, 75%, 14%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Late submissions</span>
                  <Badge variant="outline" className="text-destructive">{lateSubmissions} / {totalSubmissions}</Badge>
                </div>
              </>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">No submissions</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollment Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[240px]" /> : enrollmentStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={enrollmentStatusData} cx="50%" cy="50%" outerRadius={70} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {enrollmentStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">No student data</div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Row 4: Level Distribution (hidden for accountant) + Quick Numbers (accountant-aware) */}
      <div className="grid gap-6 md:grid-cols-2">
        {!isAccountant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Students by Level</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[240px]" /> : levelDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={levelDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="value" fill="hsl(181, 69%, 39%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-muted-foreground text-sm">No class data</div>
            )}
          </CardContent>
        </Card>
        )}

        <Card className={isAccountant ? 'md:col-span-2' : ''}>
          <CardHeader>
            <CardTitle className="text-base">Quick Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {isAccountant ? (
                <>
                  <QuickStat label="Fee Structures" value={analyticsData?.studentFees.length ? new Set(analyticsData.studentFees.map((f: any) => f.student_id)).size : 0} icon={CreditCard} />
                  <QuickStat label="Payment Methods Used" value={paymentMethodData.length} icon={FileText} />
                  <QuickStat label="Active Classes" value={analyticsData?.classArms.length || 0} icon={GraduationCap} />
                  <QuickStat label="Students" value={analyticsData?.students.length || 0} icon={Users} />
                </>
              ) : (
                <>
                  <QuickStat label="Classes" value={analyticsData?.classArms.length || 0} icon={GraduationCap} />
                  <QuickStat label="Subjects" value={analyticsData?.subjects.length || 0} icon={BookOpen} />
                  <QuickStat label="Active Classrooms" value={analyticsData?.classrooms.filter((c: any) => !c.is_archived).length || 0} icon={FileText} />
                  <QuickStat label="Active Events" value={analyticsData?.events.filter((e: any) => e.is_active).length || 0} icon={Calendar} />
                  <QuickStat label="Total Submissions" value={totalSubmissions} icon={Award} />
                  <QuickStat label="Staff Members" value={analyticsData?.staff.length || 0} icon={Users} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg bg-muted p-2.5 ${color}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="rounded-md bg-muted p-2 text-muted-foreground">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

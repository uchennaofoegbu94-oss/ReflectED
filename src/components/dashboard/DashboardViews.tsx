import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  Users,
  GraduationCap,
  ClipboardCheck,
  CreditCard,
  TrendingUp,
  BookOpen,
  FileText,
  Calendar,
  Bell,
  ArrowRight,
  UserPlus,
  UserMinus,
  QrCode,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Link, useNavigate } from 'react-router-dom';
import { JoinClassroomDialog } from '@/components/classroom/JoinClassroomDialog';
import { MyClassroomsSection } from '@/components/classroom/MyClassroomsSection';
import { AddStudentDialog } from '@/components/principal/AddStudentDialog';
import { ConnectChildDialog } from '@/components/parent/ConnectChildDialog';
import { StudentQRCode } from '@/components/attendance/StudentQRCode';
import { StaffSelfClockIn } from '@/components/attendance/StaffSelfClockIn';
import { useMyLibraryLoans, isLoanOverdue } from '@/hooks/useLibrary';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useDashboardStats, useRecentPayments, useOutstandingFeesTotal } from '@/hooks/useDashboardStats';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { usePendingAssignments } from '@/hooks/usePendingAssignments';
import { useUpcomingEvents } from '@/hooks/useEvents';
import { useStudentPendingAssignments, useStudentStats, useStudentPendingQuizzes } from '@/hooks/useStudentDashboard';
import { useParentChildren, useUnlinkChild, useChildDashboardStats } from '@/hooks/useParentChildren';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchool } from '@/contexts/SchoolContext';

function SchoolGreeting() {
  const { school, isLoading } = useSchool();
  if (isLoading) return <Skeleton className="h-5 w-64" />;
  return (
    <p className="text-muted-foreground mt-1">
      Here's what's happening at {school?.name || 'your school'} today
    </p>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [clockInOpen, setClockInOpen] = useState(false);
  
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();
  const { data: pendingAssignments, isLoading: assignmentsLoading } = usePendingAssignments();
  const { data: upcomingEvents, isLoading: eventsLoading } = useUpcomingEvents(3);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}K`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const handleGenerateReport = () => {
    navigate('/reports');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">
            Hello, {user?.name || 'Admin'}
          </h1>
          <SchoolGreeting />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setClockInOpen(true)}>
            <QrCode size={18} />
            Clock In / Out
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleGenerateReport}>
            <FileText size={18} />
            Generate Report
          </Button>
          <Button className="btn-accent gap-2" onClick={() => setAddStudentOpen(true)}>
            <Users size={18} />
            Add Student
          </Button>
        </div>
      </div>

      <StaffSelfClockIn open={clockInOpen} onOpenChange={setClockInOpen} />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Total Students"
              value={stats?.totalStudents || 0}
              change={stats?.newStudentsThisMonth ? `+${stats.newStudentsThisMonth} this month` : 'No new students'}
              changeType={stats?.newStudentsThisMonth ? 'positive' : 'neutral'}
              icon={Users}
              variant="primary"
            />
            <StatCard
              title="Total Teachers"
              value={stats?.totalTeachers || 0}
              change="Active staff"
              changeType="neutral"
              icon={GraduationCap}
              variant="secondary"
            />
            <StatCard
              title="Attendance Rate"
              value={stats?.attendanceRate ? `${stats.attendanceRate}%` : 'N/A'}
              change="Today's attendance"
              changeType={stats?.attendanceRate && stats.attendanceRate >= 90 ? 'positive' : 'neutral'}
              icon={ClipboardCheck}
              variant="success"
            />
            <StatCard
              title="Fees Collected"
              value={formatCurrency(stats?.feesCollected || 0)}
              change="Total confirmed"
              changeType="neutral"
              icon={CreditCard}
              variant="accent"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-secondary">
              View All <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 rounded-lg border border-border/50 p-4 transition-colors hover:bg-muted/50">
                    <div className="rounded-lg bg-secondary/10 p-2 text-secondary">
                      <item.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.action}</p>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground/70">Activity will appear here as you use the system</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Upcoming Events</CardTitle>
            <Link to="/events">
              <Button variant="ghost" size="icon" title="View all events">
                <Calendar size={18} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="text-xs font-medium">
                        {new Date(event.event_date).toLocaleDateString('en-NG', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold">
                        {new Date(event.event_date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{event.title}</p>
                      <Badge variant="outline" className="mt-1 text-xs capitalize">
                        {event.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming events</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Assignments & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Pending Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : pendingAssignments && pendingAssignments.length > 0 ? (
              <div className="space-y-4">
                {pendingAssignments.map((assignment) => (
                  <div key={assignment.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{assignment.title}</p>
                        <p className="text-xs text-muted-foreground">{assignment.subject}</p>
                      </div>
                      <Badge variant="outline">Due {assignment.due}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <Progress 
                        value={assignment.total > 0 ? (assignment.submissions / assignment.total) * 100 : 0} 
                        className="h-2 flex-1" 
                      />
                      <span className="text-sm text-muted-foreground">
                        {assignment.submissions}/{assignment.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No pending assignments</p>
                <p className="text-sm text-muted-foreground/70">Create assignments in your classrooms</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => navigate('/attendance')}
                className="flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:border-secondary hover:shadow-md"
              >
                <div className="rounded-lg p-2 bg-success/10 text-success">
                  <ClipboardCheck size={20} />
                </div>
                <span className="font-medium text-foreground">Mark Attendance</span>
              </button>
              <button
                onClick={() => navigate('/classroom')}
                className="flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:border-secondary hover:shadow-md"
              >
                <div className="rounded-lg p-2 bg-secondary/10 text-secondary">
                  <BookOpen size={20} />
                </div>
                <span className="font-medium text-foreground">Create Assignment</span>
              </button>
              <button
                onClick={() => navigate('/communication')}
                className="flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:border-secondary hover:shadow-md"
              >
                <div className="rounded-lg p-2 bg-accent/20 text-accent-foreground">
                  <Bell size={20} />
                </div>
                <span className="font-medium text-foreground">Send Notification</span>
              </button>
              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:border-secondary hover:shadow-md"
              >
                <div className="rounded-lg p-2 bg-primary/10 text-primary">
                  <TrendingUp size={20} />
                </div>
                <span className="font-medium text-foreground">View Reports</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Student Dialog */}
      <AddStudentDialog open={addStudentOpen} onOpenChange={setAddStudentOpen} />
    </div>
  );
}

export function AccountantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: outstandingFees, isLoading: outstandingLoading } = useOutstandingFeesTotal();
  const { data: recentPayments, isLoading: paymentsLoading } = useRecentPayments();

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(0)}K`;
    return `₦${amount.toLocaleString()}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">
            Hello, {user?.name || 'Accountant'}
          </h1>
          <SchoolGreeting />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={() => navigate('/analytics')}>
            <TrendingUp size={18} />
            View Analytics
          </Button>
          <Button className="btn-accent gap-2" onClick={() => navigate('/fees')}>
            <CreditCard size={18} />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Stats Grid — finance-only, no student-body/attendance metrics
          that belong to a teaching dashboard, not an accounting one. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsLoading || outstandingLoading ? (
          <>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              title="Fees Collected"
              value={formatCurrency(stats?.feesCollected || 0)}
              change="Total confirmed"
              changeType="neutral"
              icon={CreditCard}
              variant="accent"
            />
            <StatCard
              title="Outstanding Fees"
              value={formatCurrency(outstandingFees || 0)}
              change="Across all students"
              changeType={outstandingFees && outstandingFees > 0 ? 'negative' : 'positive'}
              icon={CreditCard}
              variant="primary"
            />
            <StatCard
              title="Total Students"
              value={stats?.totalStudents || 0}
              change="For context"
              changeType="neutral"
              icon={Users}
              variant="secondary"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Payments — the finance-relevant equivalent of the
            generic "Recent Activity" feed on the teaching/admin
            dashboard, which is about assignments/classroom posts. */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Recent Payments</CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-secondary" onClick={() => navigate('/fees')}>
              View All <ArrowRight size={14} />
            </Button>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : recentPayments && recentPayments.length > 0 ? (
              <div className="space-y-3">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                    <div>
                      <p className="font-medium text-foreground">{payment.student_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {payment.method?.replace('_', ' ') || 'Payment'} · {new Date(payment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-semibold text-foreground">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No payments recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions — accountant-specific, not the teaching/admin
            set (Mark Attendance, Create Assignment, etc. have no
            business on this role's dashboard). */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <button
                onClick={() => navigate('/fees')}
                className="flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:border-secondary hover:shadow-md"
              >
                <div className="rounded-lg p-2 bg-accent/20 text-accent-foreground">
                  <CreditCard size={20} />
                </div>
                <span className="font-medium text-foreground">Record a Payment</span>
              </button>
              <button
                onClick={() => navigate('/fees')}
                className="flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:border-secondary hover:shadow-md"
              >
                <div className="rounded-lg p-2 bg-secondary/10 text-secondary"
                >
                  <FileText size={20} />
                </div>
                <span className="font-medium text-foreground">Manage Fee Structures</span>
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="flex items-center gap-3 rounded-xl border border-border p-4 transition-all hover:border-secondary hover:shadow-md"
              >
                <div className="rounded-lg p-2 bg-primary/10 text-primary">
                  <TrendingUp size={20} />
                </div>
                <span className="font-medium text-foreground">View Fee Analytics</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TeacherDashboard() {
  const { user } = useAuth();
  const { data: pendingAssignments, isLoading: assignmentsLoading } = usePendingAssignments();
  const { data: upcomingEvents, isLoading: eventsLoading } = useUpcomingEvents(3);
  const [clockInOpen, setClockInOpen] = useState(false);
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">
            Hello, {user?.name || 'Teacher'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your classrooms and assignments
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setClockInOpen(true)}>
            <QrCode size={18} />
            Clock In / Out
          </Button>
          <Link to="/classroom">
            <Button className="btn-teal gap-2">
              <BookOpen size={18} />
              Go to Classroom
            </Button>
          </Link>
        </div>
      </div>

      <StaffSelfClockIn open={clockInOpen} onOpenChange={setClockInOpen} />

      <OverdueLibraryBanner />

      {/* My Classrooms Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MyClassroomsSection isTeacher={true} limit={4} />
        </div>

        {/* Upcoming Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Upcoming Events</CardTitle>
            <Link to="/events">
              <Button variant="ghost" size="icon" title="View all events">
                <Calendar size={18} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : upcomingEvents && upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="text-xs font-medium">
                        {new Date(event.event_date).toLocaleDateString('en-NG', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold">
                        {new Date(event.event_date).getDate()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{event.title}</p>
                      <Badge variant="outline" className="mt-1 text-xs capitalize">
                        {event.type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming events</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Pending Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : pendingAssignments && pendingAssignments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingAssignments.map((assignment) => (
                <div key={assignment.id} className="space-y-2 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">{assignment.subject}</p>
                    </div>
                    <Badge variant="outline">Due {assignment.due}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress 
                      value={assignment.total > 0 ? (assignment.submissions / assignment.total) * 100 : 0} 
                      className="h-2 flex-1" 
                    />
                    <span className="text-sm text-muted-foreground">
                      {assignment.submissions}/{assignment.total}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No pending assignments</p>
              <p className="text-sm text-muted-foreground/70">Create assignments in your classrooms</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StudentDashboard() {
  const { user } = useAuth();
  const { data: pendingAssignments = [], isLoading: assignmentsLoading } = useStudentPendingAssignments();
  const { data: pendingQuizzes = [], isLoading: quizzesLoading } = useStudentPendingQuizzes();
  const { data: stats, isLoading: statsLoading } = useStudentStats();
  const { data: upcomingEvents, isLoading: eventsLoading } = useUpcomingEvents(3);
  const { data: studentInfo } = useQuery({
    queryKey: ['my-student-info', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name, admission_number, school_id, class_arms(name)')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">
            Hello, {user?.name || 'Student'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {pendingAssignments.length > 0 
              ? `You have ${pendingAssignments.length} assignment${pendingAssignments.length > 1 ? 's' : ''} pending`
              : 'No pending assignments'}
          </p>
        </div>
        <div className="flex gap-3">
          <JoinClassroomDialog />
          <Link to="/classroom">
            <Button variant="outline" className="gap-2">
              <BookOpen size={18} />
              My Classrooms
            </Button>
          </Link>
        </div>
      </div>

      <OverdueLibraryBanner />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        ) : (
          <>
            <StatCard
              title="My Classrooms"
              value={stats?.classroomCount || 0}
              icon={BookOpen}
              variant="primary"
            />
            <StatCard
              title="Pending Assignments"
              value={stats?.pendingAssignments || 0}
              icon={FileText}
              variant="accent"
            />
            <StatCard
              title="Submitted"
              value={stats?.submittedCount || 0}
              icon={ClipboardCheck}
              variant="success"
            />
            <StatCard
              title="Graded"
              value={stats?.gradedCount || 0}
              icon={TrendingUp}
              variant="secondary"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Upcoming Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : pendingAssignments.length > 0 ? (
              <div className="space-y-3">
                {pendingAssignments.slice(0, 4).map((item) => (
                  <Link key={item.id} to={`/classroom?id=${item.classroomId}`} className="block">
                    <div className="rounded-lg border border-border p-4 transition-all hover:border-secondary hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.classroomName}</p>
                        </div>
                        <Badge variant="outline">
                          {item.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}` : 'No due date'}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No pending assignments</p>
                <p className="text-sm text-muted-foreground/70">You're all caught up!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Classrooms */}
        <MyClassroomsSection isTeacher={false} limit={4} />
      </div>

      {/* Student QR Code */}
      {studentInfo && (
        <div className="flex justify-center md:justify-start">
          <StudentQRCode
            type="STU"
            id={studentInfo.id}
            schoolId={(studentInfo as any).school_id}
            name={`${studentInfo.first_name} ${studentInfo.last_name}`}
            subtitle={studentInfo.admission_number}
          />
        </div>
      )}

      {/* Pending Quizzes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display flex items-center gap-2">
            <ListChecks size={20} /> Pending Quizzes
          </CardTitle>
          <Link to="/quizzes">
            <Button variant="ghost" size="sm" className="gap-1 text-secondary">
              View All <ArrowRight size={14} />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {quizzesLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : pendingQuizzes.length > 0 ? (
            <div className="space-y-3">
              {pendingQuizzes.slice(0, 4).map((quiz) => (
                <Link key={quiz.id} to={`/quizzes?classroom=${quiz.classroomId}`} className="block">
                  <div className="rounded-lg border border-border p-4 transition-all hover:border-secondary hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{quiz.title}</p>
                        <p className="text-sm text-muted-foreground">{quiz.classroomName}</p>
                      </div>
                      <Badge variant="outline">
                        {quiz.scheduledAt
                          ? `Opens ${new Date(quiz.scheduledAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`
                          : quiz.durationMinutes ? `${quiz.durationMinutes} min` : 'Available now'}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ListChecks className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No pending quizzes</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Upcoming Events</CardTitle>
          <Link to="/events">
            <Button variant="ghost" size="sm" className="gap-1 text-secondary">
              View All <ArrowRight size={14} />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-48 rounded-lg" />
              ))}
            </div>
          ) : upcomingEvents && upcomingEvents.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex-shrink-0 w-48 rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="text-xs font-medium">
                        {new Date(event.event_date).toLocaleDateString('en-NG', { month: 'short' })}
                      </span>
                      <span className="text-sm font-bold">
                        {new Date(event.event_date).getDate()}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      {event.type}
                    </Badge>
                  </div>
                  <p className="font-medium text-foreground line-clamp-2">{event.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming events</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ParentDashboard() {
  const { user } = useAuth();
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const unlinkChild = useUnlinkChild();
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  const selectedChild = children[selectedChildIdx] || null;
  const { data: childStats } = useChildDashboardStats(selectedChild?.id);

  const handleSwitchChild = () => {
    if (children.length > 1) {
      setSelectedChildIdx((prev) => (prev + 1) % children.length);
    }
  };

  const handleUnlink = async (studentId: string) => {
    if (!confirm('Unlink this child from your account?')) return;
    await unlinkChild.mutateAsync(studentId);
    setSelectedChildIdx(0);
  };
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">
            Hello, {user?.name || 'Parent'}
          </h1>
          <p className="text-muted-foreground mt-1">
            Stay updated on your child's progress
          </p>
        </div>
        <Button className="gap-2" onClick={() => setConnectDialogOpen(true)}>
          <UserPlus size={16} />
          Connect Child
        </Button>
      </div>

      {/* Child Selector */}
      {childrenLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : children.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
            <h3 className="font-semibold text-foreground">No children linked</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Connect Child" to link your child using their admission number
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedChild?.avatar_url || undefined} />
                <AvatarFallback>
                  {selectedChild ? `${selectedChild.first_name[0]}${selectedChild.last_name[0]}` : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {selectedChild ? `${selectedChild.first_name} ${selectedChild.last_name}` : 'Select a child'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedChild?.class_arms ? `${selectedChild.class_arms.name} ${selectedChild.class_arms.arm}` : 'No class'} • {selectedChild?.admission_number}
                </p>
              </div>
              <div className="flex gap-2">
                {children.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleSwitchChild}>
                    Switch Child ({selectedChildIdx + 1}/{children.length})
                  </Button>
                )}
                {selectedChild && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleUnlink(selectedChild.id)}
                   title="Unlink child">
                    <UserMinus size={16} />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedChild && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Attendance"
              value={childStats?.attendanceRate != null ? `${childStats.attendanceRate}%` : '--'}
              change="This term"
              changeType="neutral"
              icon={ClipboardCheck}
              variant="success"
            />
            <StatCard
              title="Term Average"
              value={childStats?.termAverage != null ? `${childStats.termAverage}%` : '--'}
              change="Current term"
              changeType="neutral"
              icon={TrendingUp}
              variant="secondary"
            />
            <StatCard
              title="Outstanding Fees"
              value={childStats?.outstandingFees != null ? `₦${childStats.outstandingFees.toLocaleString()}` : '--'}
              change="This session"
              changeType="neutral"
              icon={CreditCard}
              variant="accent"
            />
            <StatCard
              title="Class"
              value={selectedChild.class_arms ? `${selectedChild.class_arms.name}` : '--'}
              change={selectedChild.admission_number}
              changeType="neutral"
              icon={GraduationCap}
              variant="primary"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Child Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{selectedChild.first_name} {selectedChild.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Admission No.</span>
                    <span className="font-medium">{selectedChild.admission_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gender</span>
                    <span className="font-medium capitalize">{selectedChild.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Class</span>
                    <span className="font-medium">
                      {selectedChild.class_arms ? `${selectedChild.class_arms.name} ${selectedChild.class_arms.arm}` : 'Not assigned'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display">Quick Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start gap-2" asChild>
                    <Link to="/results"><FileText size={16} /> View Results</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" asChild>
                    <Link to="/attendance"><ClipboardCheck size={16} /> View Attendance</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" asChild>
                    <Link to="/fees"><CreditCard size={16} /> View Fees</Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" asChild>
                    <Link to="/events"><Calendar size={16} /> View Events</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <ConnectChildDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} />
    </div>
  );
}

// ─── Overdue Library Books (#12 in-app reminder) ───
function OverdueLibraryBanner() {
  const { data: loans = [] } = useMyLibraryLoans();
  const overdue = loans.filter(isLoanOverdue);
  if (overdue.length === 0) return null;

  return (
    <Link to="/library">
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm hover:bg-destructive/15 transition-colors">
        <BookOpen size={16} />
        You have {overdue.length} overdue library book{overdue.length !== 1 ? 's' : ''} — tap to view
      </div>
    </Link>
  );
}

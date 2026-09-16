import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SchoolProvider } from "@/contexts/SchoolContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import LandingPage from "./pages/LandingPage";
import Fees from "./pages/Fees";
import Dashboard from "./pages/Dashboard";
import Classroom from "./pages/Classroom";
import Assignments from "./pages/Assignments";
import Quizzes from "./pages/Quizzes";
import Results from "./pages/Results";
import ExternalExams from "./pages/ExternalExams";
import Students from "./pages/Students";
import Attendance from "./pages/Attendance";
import Teachers from "./pages/Teachers";
import Parents from "./pages/Parents";
import Classes from "./pages/Classes";
import Subjects from "./pages/Subjects";
import Communication from "./pages/Communication";
import Roles from "./pages/Roles";
import Events from "./pages/Events";
import Profile from "./pages/Profile";
import Timetable from "./pages/Timetable";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Library from "./pages/Library";
import Settings from "./pages/Settings";
import IDCards from "./pages/IDCards";
import SuperAdminSchools from "./pages/super-admin/SuperAdminSchools";
import SuperAdminSchoolDetail from "./pages/super-admin/SuperAdminSchoolDetail";
import SuperAdminUsers from "./pages/super-admin/SuperAdminUsers";
import SuperAdminBilling from "./pages/super-admin/SuperAdminBilling";
import SuperAdminAnalytics from "./pages/super-admin/SuperAdminAnalytics";
import SuperAdminAuditLog from "./pages/super-admin/SuperAdminAuditLog";
import SuperAdminSupportTickets from "./pages/super-admin/SuperAdminSupportTickets";
import SuperAdminMessagingPage from "./pages/super-admin/SuperAdminMessagingPage";
import SuperAdminAnnouncements from "./pages/super-admin/SuperAdminAnnouncements";
import SuperAdminApprovals from "./pages/super-admin/SuperAdminApprovals";
import SuperAdminSettingsPage from "./pages/super-admin/SuperAdminSettingsPage";
import ResetPassword from "./pages/ResetPassword";
import AwaitingApproval from "./pages/AwaitingApproval";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // #4: a self-signup that hasn't been reviewed yet has no functional
  // access on the backend either (has_role()/is_staff() both require
  // 'approved') — this just gives them a clear screen instead of a
  // dashboard that silently can't load anything.
  if (user?.approvalStatus === 'pending' || user?.approvalStatus === 'rejected') {
    return <AwaitingApproval status={user.approvalStatus} />;
  }
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/admin-login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const defaultRoute = user?.isSuperAdmin && !user?.schoolId ? '/super-admin' : '/dashboard';

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <Login />} />
      <Route path="/admin-login" element={isAuthenticated ? <Navigate to={defaultRoute} /> : <AdminLogin />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/super-admin" element={<SuperAdminRoute><Navigate to="/super-admin/schools" replace /></SuperAdminRoute>} />
        <Route path="/super-admin/schools" element={<SuperAdminRoute><SuperAdminSchools /></SuperAdminRoute>} />
        <Route path="/super-admin/schools/:schoolId" element={<SuperAdminRoute><SuperAdminSchoolDetail /></SuperAdminRoute>} />
        <Route path="/super-admin/users" element={<SuperAdminRoute><SuperAdminUsers /></SuperAdminRoute>} />
        <Route path="/super-admin/billing" element={<SuperAdminRoute><SuperAdminBilling /></SuperAdminRoute>} />
        <Route path="/super-admin/analytics" element={<SuperAdminRoute><SuperAdminAnalytics /></SuperAdminRoute>} />
        <Route path="/super-admin/audit-log" element={<SuperAdminRoute><SuperAdminAuditLog /></SuperAdminRoute>} />
        <Route path="/super-admin/support" element={<SuperAdminRoute><SuperAdminSupportTickets /></SuperAdminRoute>} />
        <Route path="/super-admin/messaging" element={<SuperAdminRoute><SuperAdminMessagingPage /></SuperAdminRoute>} />
        <Route path="/super-admin/announcements" element={<SuperAdminRoute><SuperAdminAnnouncements /></SuperAdminRoute>} />
        <Route path="/super-admin/approvals" element={<SuperAdminRoute><SuperAdminApprovals /></SuperAdminRoute>} />
        <Route path="/super-admin/settings" element={<SuperAdminRoute><SuperAdminSettingsPage /></SuperAdminRoute>} />
        <Route path="/classroom" element={<Classroom />} />
        <Route path="/assignments" element={<Assignments />} />
        <Route path="/students" element={<Students />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/teachers" element={<Teachers />} />
        <Route path="/parents" element={<Parents />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/events" element={<Events />} />
        <Route path="/communication" element={<Communication />} />
        <Route path="/quizzes" element={<Quizzes />} />
        <Route path="/results" element={<Results />} />
        <Route path="/external-exams" element={<ExternalExams />} />
        <Route path="/fees" element={<Fees />} />
        <Route path="/timetable" element={<Timetable />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/library" element={<Library />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/id-cards" element={<IDCards />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SchoolProvider>
            <AppRoutes />
          </SchoolProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

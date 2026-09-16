import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import {
  AdminDashboard,
  AccountantDashboard,
  TeacherDashboard,
  StudentDashboard,
  ParentDashboard,
} from '@/components/dashboard/DashboardViews';

export default function Dashboard() {
  const { user } = useAuth();

  // A super admin has no case below (their access comes from the separate
  // super_admins table, not a school user_roles entry) — previously this
  // silently fell through to the `default` branch and rendered a Teacher
  // dashboard. Send them to the real super-admin console instead, even if
  // they happen to also carry a schoolId.
  if (user?.isSuperAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  const renderDashboard = () => {
    switch (user?.role) {
      case 'admin':
      case 'principal':
        return <AdminDashboard />;
      case 'accountant':
        return <AccountantDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'student':
        return <StudentDashboard />;
      case 'parent':
        return <ParentDashboard />;
      default:
        return <TeacherDashboard />;
    }
  };

  return renderDashboard();
}

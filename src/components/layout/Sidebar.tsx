import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { UserRole } from '@/types';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  ClipboardCheck, FileText, CreditCard, MessageSquare, Settings,
  ChevronLeft, ChevronRight, LogOut, BookMarked, FileQuestion,
  BarChart3, UserCheck, Shield, CreditCard as IDCardIcon, Building2, Award, Printer,
  Ticket, Bell, Clock,
} from 'lucide-react';

import { useMyPermissions, type PermissionKey } from '@/hooks/usePermissions';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: UserRole[];
  /** Also shown if the user has been delegated any of these permissions (#11),
   * even when their base role wouldn't otherwise include this item. */
  permissions?: PermissionKey[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['admin', 'principal', 'teacher', 'student', 'parent', 'accountant'] },
  { label: 'Students', icon: Users, path: '/students', roles: ['admin', 'principal', 'teacher'] },
  { label: 'Teachers', icon: UserCheck, path: '/teachers', roles: ['admin', 'principal'] },
  { label: 'Parents', icon: Users, path: '/parents', roles: ['admin', 'principal'] },
  { label: 'Classes', icon: GraduationCap, path: '/classes', roles: ['admin', 'principal', 'teacher'] },
  { label: 'Subjects', icon: BookOpen, path: '/subjects', roles: ['admin', 'principal'] },
  { label: 'Roles', icon: Shield, path: '/roles', roles: ['admin', 'principal'] },
  { label: 'Events', icon: Calendar, path: '/events', roles: ['admin', 'principal', 'teacher', 'student', 'parent', 'accountant'] },
  { label: 'My Classroom', icon: BookOpen, path: '/classroom', roles: ['teacher', 'student'] },
  { label: 'Assignments', icon: BookMarked, path: '/assignments', roles: ['teacher', 'student'] },
  { label: 'Quizzes', icon: FileQuestion, path: '/quizzes', roles: ['teacher', 'student'] },
  { label: 'Attendance', icon: ClipboardCheck, path: '/attendance', roles: ['admin', 'principal', 'teacher', 'student', 'parent'] },
  { label: 'Results', icon: FileText, path: '/results', roles: ['admin', 'principal', 'teacher', 'student', 'parent'] },
  { label: 'External Exams', icon: Award, path: '/external-exams', roles: ['admin', 'principal', 'teacher', 'student', 'parent'] },
  { label: 'Fees & Payments', icon: CreditCard, path: '/fees', roles: ['admin', 'principal', 'accountant', 'parent'] },
  { label: 'Timetable', icon: Calendar, path: '/timetable', roles: ['admin', 'principal', 'teacher', 'student'] },
  { label: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['admin', 'principal', 'accountant'] },
  { label: 'Reports', icon: Printer, path: '/reports', roles: ['admin', 'principal'], permissions: ['generate_reports'] },
  { label: 'Library', icon: BookMarked, path: '/library', roles: ['admin', 'principal', 'teacher', 'student'] },
  { label: 'Communication', icon: MessageSquare, path: '/communication', roles: ['admin', 'principal', 'teacher', 'parent'] },
  { label: 'ID Cards', icon: IDCardIcon, path: '/id-cards', roles: ['admin', 'principal'] },
  { label: 'Settings', icon: Settings, path: '/settings', roles: ['admin', 'principal'], permissions: ['manage_school_settings', 'view_audit_log'] },
];

// Replaces the old single hardcoded "Schools" link — a pure super admin
// (no schoolId) previously got an almost-empty sidebar with nothing else
// navigable, which is exactly the "no control switches/tabs/buttons
// anywhere" gap. Rendered instead of the regular school-scoped navItems
// below (a super admin who also happens to carry a schoolId still only
// needs this list — their platform-level access is the point of being
// here at /super-admin/*).
const superAdminNavItems: { label: string; icon: React.ElementType; path: string }[] = [
  { label: 'Schools', icon: Building2, path: '/super-admin/schools' },
  { label: 'Users', icon: Users, path: '/super-admin/users' },
  { label: 'Billing', icon: CreditCard, path: '/super-admin/billing' },
  { label: 'Analytics', icon: BarChart3, path: '/super-admin/analytics' },
  { label: 'Audit Log', icon: Shield, path: '/super-admin/audit-log' },
  { label: 'Support', icon: Ticket, path: '/super-admin/support' },
  { label: 'Messaging', icon: MessageSquare, path: '/super-admin/messaging' },
  { label: 'Announcements', icon: Bell, path: '/super-admin/announcements' },
  { label: 'Approvals', icon: Clock, path: '/super-admin/approvals' },
  { label: 'Settings', icon: Settings, path: '/super-admin/settings' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { school } = useSchool();
  const location = useLocation();
  const { data: myPermissions } = useMyPermissions();

  const filteredItems = user?.schoolId
    ? navItems.filter(item =>
        user?.role && (
          item.roles.includes(user.role as UserRole)
          || item.permissions?.some((p) => myPermissions?.has(p))
        )
      )
    : [];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo / School Branding */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center gap-3 overflow-hidden">
          {school?.logo_url ? (
            <img src={school.logo_url} alt={school.name} className="h-10 w-10 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary flex-shrink-0">
              <span className="font-display text-lg font-bold text-sidebar-primary-foreground">
                {school?.name?.[0] || 'R'}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-display text-lg font-bold text-sidebar-foreground truncate">
                {school?.name || 'ReflectED'}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                {school ? 'School System' : 'Platform Admin'}
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded-lg p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:block"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {/* Super Admin Nav */}
          {user?.isSuperAdmin && superAdminNavItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/super-admin/schools' && location.pathname === '/super-admin');
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={20} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}

          {/* Regular Nav Items */}
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={20} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-4">
        <Link
          to="/profile"
          className={`flex items-center rounded-lg p-2 transition-colors hover:bg-sidebar-accent ${collapsed ? 'justify-center' : 'gap-3'}`}
        >
          <img
            src={user?.avatar}
            alt={user?.name}
            className="h-10 w-10 rounded-full bg-sidebar-accent"
          />
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.name}
              </p>
              <p className="truncate text-xs capitalize text-sidebar-foreground/60">
                {user?.isSuperAdmin ? 'Super Admin' : user?.role}
              </p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-destructive hover:text-white"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}

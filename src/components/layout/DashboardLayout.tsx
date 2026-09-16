import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';
import { InstallPromptBanner } from './InstallPromptBanner';
import { PlatformAnnouncementBanner } from './PlatformAnnouncementBanner';
import { SchoolAnnouncementBanner } from './SchoolAnnouncementBanner';
import { useTenantBranding } from '@/hooks/useTenantBranding';

export function DashboardLayout() {
  useTenantBranding();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Sidebar />
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        sidebarCollapsed={sidebarCollapsed}
        onMenuClick={() => setMobileMenuOpen(true)}
      />

      {/* Main Content */}
      <main
        className={`min-h-screen pt-16 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <div className="container py-6 space-y-4">
          <PlatformAnnouncementBanner />
          <SchoolAnnouncementBanner />
          <OfflineBanner />
          <InstallPromptBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}

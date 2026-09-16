import { useState } from 'react';
import { usePlatformAnnouncements } from '@/hooks/usePlatformAnnouncements';
import { AlertTriangle, Bell, Activity, XCircle, X } from 'lucide-react';

const typeIcons: Record<string, any> = {
  banner: AlertTriangle,
  notice: Bell,
  update: Activity,
  downtime: XCircle,
};

const typeBg: Record<string, string> = {
  banner: 'bg-warning/15 border-warning/30 text-warning-foreground',
  notice: 'bg-primary/10 border-primary/30 text-foreground',
  update: 'bg-secondary/10 border-secondary/30 text-foreground',
  downtime: 'bg-destructive/10 border-destructive/30 text-destructive',
};

export function PlatformAnnouncementBanner() {
  const { data: announcements = [] } = usePlatformAnnouncements();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = announcements.filter((a: any) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a: any) => {
        const Icon = typeIcons[a.announcement_type] || Bell;
        const bgClass = typeBg[a.announcement_type] || typeBg.notice;
        return (
          <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${bgClass}`}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{a.title}</p>
              <p className="text-xs opacity-80 mt-0.5">{a.content}</p>
            </div>
            <button onClick={() => setDismissed(prev => new Set([...prev, a.id]))} className="shrink-0 p-1 rounded hover:bg-foreground/10">
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

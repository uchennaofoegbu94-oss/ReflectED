import { AttendanceRecord } from '@/types';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceStatusProps {
  status: AttendanceRecord['status'];
  size?: 'sm' | 'md' | 'lg';
}

export function AttendanceStatus({ status, size = 'md' }: AttendanceStatusProps) {
  const sizes = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  const statusConfig = {
    present: {
      icon: CheckCircle2,
      bg: 'bg-success/10',
      text: 'text-success',
      label: 'P',
    },
    absent: {
      icon: XCircle,
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      label: 'A',
    },
    late: {
      icon: Clock,
      bg: 'bg-accent/20',
      text: 'text-accent-foreground',
      label: 'L',
    },
    excused: {
      icon: AlertCircle,
      bg: 'bg-secondary/10',
      text: 'text-secondary',
      label: 'E',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full font-medium',
        sizes[size],
        config.bg,
        config.text
      )}
      title={status}
    >
      <Icon size={iconSizes[size]} />
    </div>
  );
}

interface AttendanceGridProps {
  days: { date: string; status: AttendanceRecord['status'] }[];
}

export function AttendanceGrid({ days }: AttendanceGridProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {days.map((day, index) => (
        <div
          key={index}
          className="group relative"
          title={`${new Date(day.date).toLocaleDateString()}: ${day.status}`}
        >
          <AttendanceStatus status={day.status} size="sm" />
        </div>
      ))}
    </div>
  );
}

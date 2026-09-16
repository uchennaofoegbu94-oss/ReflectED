import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-4 py-2 flex items-center gap-2 text-sm rounded-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline. Some features are unavailable.</span>
    </div>
  );
}

import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Offline() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-4">
        <WifiOff className="h-16 w-16 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">You're Offline</h1>
        <p className="text-muted-foreground">
          Please reconnect to the internet to access this page.
        </p>
        <Button onClick={() => (window.location.href = '/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

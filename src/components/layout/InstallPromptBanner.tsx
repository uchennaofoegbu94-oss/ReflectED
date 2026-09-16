import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';
import { useSchool } from '@/contexts/SchoolContext';

export function InstallPromptBanner() {
  const { canInstall, install, dismiss } = useInstallPrompt();
  const { school } = useSchool();

  if (!canInstall) return null;

  const appName = school?.name || 'ReflectED';

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-md px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm text-foreground">
          Install <strong>{appName}</strong> for quick access from your home screen.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={install}>
          Install
        </Button>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground p-1"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

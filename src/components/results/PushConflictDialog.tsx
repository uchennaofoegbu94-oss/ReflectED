import { useMemo } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import type { PushConflict } from '@/hooks/useBroadsheetFields';

interface PushConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: PushConflict[];
  /** What this push is filling the fields FROM, e.g. "Pre-CA" or "Broadsheet". */
  newSourceLabel: string;
  onConfirm: () => void;
  confirming: boolean;
}

/**
 * Grouped, per-field summary of a push collision — e.g. "CA1: 12 students
 * already have values from a push from 'Quiz Average'." One row per
 * (field, existing-source) pair rather than one per student, since a class
 * push can touch dozens of students and per-student rows would be
 * unreadable.
 */
export function PushConflictDialog({
  open, onOpenChange, conflicts, newSourceLabel, onConfirm, confirming,
}: PushConflictDialogProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { fieldName: string; existingSourceLabel: string; studentNames: string[] }>();
    for (const c of conflicts) {
      const key = `${c.fieldName}::${c.existingSourceLabel}`;
      if (!map.has(key)) {
        map.set(key, { fieldName: c.fieldName, existingSourceLabel: c.existingSourceLabel, studentNames: [] });
      }
      map.get(key)!.studentNames.push(c.studentName);
    }
    return Array.from(map.values());
  }, [conflicts]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !confirming && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Some fields already have values</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Pushing will overwrite existing scores in {conflicts.length} place{conflicts.length === 1 ? '' : 's'}.
                Review before continuing:
              </p>
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-md border p-3 bg-muted/30">
                {groups.map((g, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium text-foreground">"{g.fieldName}"</span>
                    {' '}already contains values from {g.existingSourceLabel} for{' '}
                    <span className="font-medium text-foreground">
                      {g.studentNames.length} student{g.studentNames.length === 1 ? '' : 's'}
                    </span>
                    {g.studentNames.length <= 4 && (
                      <span className="text-muted-foreground"> ({g.studentNames.join(', ')})</span>
                    )}
                    .
                  </div>
                ))}
              </div>
              <p>Replace {conflicts.length === 1 ? 'it' : 'them all'} with values from {newSourceLabel}?</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={confirming}>
            {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Replace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

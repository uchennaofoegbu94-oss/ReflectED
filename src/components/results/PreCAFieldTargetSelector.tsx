import { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRightCircle, AlertTriangle, Lock } from 'lucide-react';
import {
  useBroadsheetFields, useFieldTargetCollision, usePipelineStageLock,
} from '@/hooks/useBroadsheetFields';

interface PreCAFieldTargetSelectorProps {
  value: string | null;
  onChange: (fieldId: string | null) => void;
  /** The classroom's subject — needed only for the collision check (which
   * field values live where), not for filtering the field list itself:
   * Pre-CA fields aren't tied to one subject in their own definition. */
  subjectId?: string;
  /** What to call this assignment/quiz in the warning message, e.g. its title
   * (or "this assignment" if untitled yet). */
  sourceLabel: string;
  /** Called when the user confirms "Replace" on the collision warning.
   * Selecting a field only changes WHERE FUTURE grades go — it doesn't
   * touch the target field's existing values by itself. If this quiz/
   * assignment already has graded work, the caller should use this to
   * actually push it now (e.g. useRepushGradesToPreCA) — otherwise
   * "Replace" closes the dialog but the old values just sit there
   * unchanged, which reads as the confirmation having done nothing. Omit
   * for contexts with nothing to backfill yet (e.g. a brand-new quiz/
   * assignment being created, which can't have graded work).
   */
  onConfirmReplace?: () => void | Promise<void>;
}

/**
 * Lets a teacher point an assignment/quiz's graded scores at a Pre-CA
 * field — the target the existing auto-propagate trigger
 * (propagate_submission_to_broadsheet) already pushes into the instant a
 * submission is graded. That trigger has no confirmation step of its own
 * (it just fires on grading), so the only place to safely warn about two
 * sources fighting over one field is right here, at config time: if the
 * field already holds values for this subject/term from somewhere else,
 * confirm before pointing this one there too.
 */
export function PreCAFieldTargetSelector({
  value, onChange, subjectId, sourceLabel, onConfirmReplace,
}: PreCAFieldTargetSelectorProps) {
  const { data: allFields = [] } = useBroadsheetFields('pre_ca');
  const { data: stageLock } = usePipelineStageLock('pre_ca');
  const isLocked = !!stageLock?.locked;
  const fields = allFields
    .filter(f => f.is_active && !f.is_computed)
    .sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0));

  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const { data: collision } = useFieldTargetCollision(pendingFieldId, subjectId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const revertRef = useRef<string | null>(value);

  useEffect(() => {
    if (pendingFieldId && collision) {
      setConfirmOpen(true);
    }
  }, [pendingFieldId, collision]);

  const handleSelect = (v: string) => {
    if (v === '__none__') {
      onChange(null);
      return;
    }
    revertRef.current = value;
    onChange(v);
    setPendingFieldId(v);
  };

  const handleConfirm = async () => {
    if (onConfirmReplace) {
      setReplacing(true);
      try {
        await onConfirmReplace();
      } finally {
        setReplacing(false);
      }
    }
    setConfirmOpen(false);
    setPendingFieldId(null);
  };

  const handleCancel = () => {
    onChange(revertRef.current);
    setConfirmOpen(false);
    setPendingFieldId(null);
  };

  const selectedField = fields.find(f => f.id === value);

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <ArrowRightCircle className="h-3.5 w-3.5 text-muted-foreground" />
        Push Scores to Pre-CA Field (optional)
      </Label>
      <p className="text-xs text-muted-foreground">
        Once a submission is graded, its score automatically fills this field for the student — scaled to
        the field's max points. Leave as "None" to grade without affecting Pre-CA.
      </p>
      <Select value={value ?? '__none__'} onValueChange={handleSelect} disabled={!subjectId}>
        <SelectTrigger>
          <SelectValue placeholder={subjectId ? 'No Pre-CA field' : 'Select a classroom first'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {fields.map(f => (
            <SelectItem key={f.id} value={f.id}>
              {f.name} (/{f.max_points} pts){f.entry_mode === 'manual' && isLocked ? ' — manual-only, locked' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fields.length === 0 && subjectId && (
        <p className="text-xs text-muted-foreground">
          No Pre-CA fields set up yet — an admin/principal can add some in the Pre-CA tab's Manage Fields.
        </p>
      )}
      {selectedField && selectedField.entry_mode === 'manual' && isLocked && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Pre-CA is locked and this field is set to manual-entry only — pushes into it will be rejected.
            Ask an admin/principal to switch it to "Push-sourced" in Pre-CA → Manage Fields, or pick a
            different field.
          </span>
        </div>
      )}
      {selectedField && selectedField.entry_mode === 'push' && isLocked && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Locked as push-sourced — this field is ready to receive scores from here.</span>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !o && !replacing && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This field already has values</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedField?.name}" already contains values from {collision?.sourceLabel}.
              {onConfirmReplace
                ? ` Replacing will immediately push any already-graded scores from "${sourceLabel}" into it, overwriting what's there now.`
                : ` Pointing "${sourceLabel}" here means future grades will overwrite it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={replacing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={replacing}>
              {replacing ? 'Replacing…' : 'Replace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

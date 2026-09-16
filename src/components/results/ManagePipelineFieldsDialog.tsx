import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, ArrowUp, ArrowDown, Loader2, Sigma, Pencil, X, Check, ArrowRight, Lock, Unlock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useBroadsheetFields, useCreateBroadsheetField, useUpdateBroadsheetField,
  useDeleteBroadsheetField, useBroadsheetFieldReferences,
  usePipelineStageLock, useSetPipelineStageLock, type BroadsheetField,
} from '@/hooks/useBroadsheetFields';

interface ManagePipelineFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which pipeline stage these fields belong to. */
  pipelineStage: 'pre_ca' | 'broadsheet';
  /** Dialog title, e.g. "Manage Pre-CA Fields" / "Manage Broadsheet Fields". */
  title: string;
}

const OPERATIONS = [
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
];

const emptyDraft = {
  name: '',
  description: '',
  max_points: 20,
  is_computed: false,
  formula_operation: 'sum' as string,
  formula_source_field_ids: [] as string[],
  push_target_field_id: null as string | null,
  entry_mode: 'manual' as 'manual' | 'push',
};

const STAGE_ORDER = ['pre_ca', 'broadsheet'] as const;
const STAGE_LABEL: Record<string, string> = { pre_ca: 'Pre-CA', broadsheet: 'Broadsheet', report_card: 'Report Card' };

export function ManagePipelineFieldsDialog({ open, onOpenChange, pipelineStage, title }: ManagePipelineFieldsDialogProps) {
  const { data: allFields = [], isLoading } = useBroadsheetFields(pipelineStage);
  // System-locked fields (e.g. Broadsheet's Final Total/Average, Report
  // Card's mirrored equivalents) are computed server-side from a fixed
  // computation_key and are never user-manageable — they're surfaced
  // elsewhere (a read-only Finals section), not in this dialog.
  const fields = allFields.filter(f => !f.is_locked);
  const createField = useCreateBroadsheetField();
  const updateField = useUpdateBroadsheetField();
  const deleteField = useDeleteBroadsheetField();

  // Entry-mode lock: while OFF, any non-computed field accepts both manual
  // and pushed writes (keeps setup/testing flexible). Once ON, the DB
  // trigger (enforce_entry_mode) starts enforcing each field's entry_mode
  // for teachers — admin/principal can always override regardless.
  const { data: stageLock } = usePipelineStageLock(pipelineStage);
  const setStageLock = useSetPipelineStageLock();
  const isStageLocked = !!stageLock?.locked;

  // A computed field can source fields from its own stage OR the one
  // immediately before it (DB-enforced) — e.g. a Broadsheet computed field
  // summing Pre-CA quiz scores directly, no push needed for that case.
  const stageIdx = STAGE_ORDER.indexOf(pipelineStage);
  const previousStage = stageIdx > 0 ? STAGE_ORDER[stageIdx - 1] : null;
  const { data: previousStageFieldsRaw = [] } = useBroadsheetFields(previousStage ?? pipelineStage);
  const previousStageFields = previousStage ? previousStageFieldsRaw.filter(f => !f.is_locked) : [];

  // Push targets point at a non-computed field in the very next stage
  // (pre_ca -> broadsheet, broadsheet -> report_card; DB-enforced by
  // validate_push_target). report_card has no next stage, so nextStage is
  // null there and the picker just won't render (showPushTarget below).
  const nextStage = stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIdx + 1] : null;
  const showPushTarget = !!nextStage;
  const { data: nextStageFieldsRaw = [] } = useBroadsheetFields(nextStage ?? pipelineStage);
  const pushTargetCandidates = nextStage
    ? nextStageFieldsRaw.filter(f => !f.is_locked && !f.is_computed)
    : [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BroadsheetField | null>(null);

  const sortedFields = [...fields].sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0));
  // Any other same-stage field — manual or computed — plus every field from
  // the previous stage, can be a source for a computed field; the DB's
  // cycle-detection trigger (prevent_computed_field_cycles) walks the
  // dependency chain transitively and rejects anything circular or out of
  // the allowed stage range, so nesting/cross-stage sourcing is safe to
  // offer here without re-implementing that check client-side. Excluding
  // the field itself just avoids an obvious, guaranteed-to-fail
  // self-reference before it round-trips to the server.
  const sourceCandidates = (excludeId?: string) => [
    ...sortedFields.filter(f => f.id !== excludeId),
    ...previousStageFields,
  ];

  // Real, cross-stage reference check for the delete-confirmation dialog
  // (server RPC — covers computed fields in any stage, not just this one).
  const { data: refs, isLoading: refsLoading } = useBroadsheetFieldReferences(pendingDelete?.id);

  const startAdd = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setAdding(true);
  };

  const startEdit = (field: BroadsheetField) => {
    setDraft({
      name: field.name,
      description: field.description || '',
      max_points: field.max_points,
      is_computed: field.is_computed,
      formula_operation: field.formula_operation || 'sum',
      formula_source_field_ids: field.formula_source_field_ids || [],
      push_target_field_id: field.push_target_field_id ?? null,
      entry_mode: (field.entry_mode as 'manual' | 'push') ?? 'manual',
    });
    setEditingId(field.id);
    setAdding(false);
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const toggleSource = (id: string) => {
    setDraft(d => ({
      ...d,
      formula_source_field_ids: d.formula_source_field_ids.includes(id)
        ? d.formula_source_field_ids.filter(x => x !== id)
        : [...d.formula_source_field_ids, id],
    }));
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error('Field name is required');
      return;
    }
    if (draft.is_computed && draft.formula_source_field_ids.length === 0) {
      toast.error('Pick at least one source field for a computed field');
      return;
    }

    try {
      if (editingId) {
        await updateField.mutateAsync({
          id: editingId,
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          max_points: draft.max_points,
          // BUG FIX: is_computed itself was never included here, only the
          // formula_* fields conditional on it — so toggling an existing
          // manual field (e.g. CA1) to computed silently never persisted;
          // formula_operation/formula_source_field_ids would save onto a
          // field the DB still considered non-computed (harmless no-op
          // there, since prevent_computed_field_cycles skips validation
          // entirely when is_computed isn't true — but nothing ever
          // actually computed either).
          is_computed: draft.is_computed,
          formula_operation: draft.is_computed ? draft.formula_operation : null,
          formula_source_field_ids: draft.is_computed ? draft.formula_source_field_ids : null,
          entry_mode: draft.is_computed ? 'manual' : draft.entry_mode,
          // BUG FIX: was hardcoded to pipelineStage === 'pre_ca', a leftover
          // from before push targets were generalized to every stage with a
          // next stage — Broadsheet's push-target picker (targeting Report
          // Card) rendered fine but silently never saved.
          ...(showPushTarget ? { push_target_field_id: draft.push_target_field_id } : {}),
        });
        toast.success('Field updated');
      } else {
        await createField.mutateAsync({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          max_points: draft.max_points,
          field_order: sortedFields.length,
          pipeline_stage: pipelineStage,
          field_scope: 'subject',
          is_computed: draft.is_computed,
          formula_operation: draft.is_computed ? draft.formula_operation : null,
          formula_source_field_ids: draft.is_computed ? draft.formula_source_field_ids : null,
          entry_mode: draft.is_computed ? 'manual' : draft.entry_mode,
          ...(showPushTarget ? { push_target_field_id: draft.push_target_field_id } : {}),
        });
        toast.success('Field added');
      }
      cancelForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save field');
    }
  };

  const handleToggleActive = async (field: BroadsheetField) => {
    try {
      await updateField.mutateAsync({ id: field.id, is_active: !field.is_active });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update field');
    }
  };

  const handleMove = async (field: BroadsheetField, direction: 'up' | 'down') => {
    const idx = sortedFields.findIndex(f => f.id === field.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedFields.length) return;
    const swapField = sortedFields[swapIdx];
    try {
      await Promise.all([
        updateField.mutateAsync({ id: field.id, field_order: swapField.field_order }),
        updateField.mutateAsync({ id: swapField.id, field_order: field.field_order }),
      ]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteField.mutateAsync(pendingDelete.id);
      toast.success('Field deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete field');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 mb-3 ${isStageLocked ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900' : 'bg-muted/30'}`}>
            <div className="flex items-start gap-2">
              {isStageLocked ? <Lock className="h-4 w-4 mt-0.5 text-amber-600" /> : <Unlock className="h-4 w-4 mt-0.5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">{isStageLocked ? 'Entry mode locked' : 'Entry mode unlocked'}</p>
                <p className="text-xs text-muted-foreground">
                  {isStageLocked
                    ? "Teachers can only fill each field the way it's set below — manual fields reject pushes, push-sourced fields reject manual typing. You (admin/principal) can still override either way."
                    : 'Any non-computed field currently accepts both manual entry and pushes. Lock once your Entry Mode choices below are final.'}
                </p>
              </div>
            </div>
            <Switch
              checked={isStageLocked}
              onCheckedChange={(checked) => setStageLock.mutate({ pipelineStage, locked: checked })}
              disabled={setStageLock.isPending}
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedFields.length === 0 && !adding ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No fields yet. Add one below — e.g. "Quiz 1", "Homework Average".
              </p>
            ) : (
              sortedFields.map((field, idx) => (
                editingId === field.id ? (
                  <FieldForm
                    key={field.id}
                    draft={draft}
                    setDraft={setDraft}
                    sourceFields={sourceCandidates(field.id)}
                    toggleSource={toggleSource}
                    onCancel={cancelForm}
                    onSave={handleSave}
                    saving={updateField.isPending}
                    isEditingComputedType={field.is_computed}
                    showPushTarget={showPushTarget}
                    pushTargetCandidates={pushTargetCandidates}
                    pipelineStage={pipelineStage}
                    nextStageLabel={nextStage ? STAGE_LABEL[nextStage] : ''}
                  />
                ) : (
                  <div
                    key={field.id}
                    className={`flex items-center gap-2 rounded-lg border p-3 ${!field.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === 0}
                        onClick={() => handleMove(field, 'up')}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        disabled={idx === sortedFields.length - 1}
                        onClick={() => handleMove(field, 'down')}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{field.name}</span>
                        <Badge variant="outline" className="text-xs">/{field.max_points} pts</Badge>
                        {field.is_computed && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Sigma className="h-3 w-3" />
                            {field.formula_operation}
                          </Badge>
                        )}
                        {!field.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                        {!field.is_computed && field.entry_mode === 'push' && (
                          <Badge variant="outline" className="text-xs gap-1 border-blue-300 text-blue-700 dark:text-blue-400">
                            Push-sourced
                          </Badge>
                        )}
                        {field.push_target_field_id && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <ArrowRight className="h-3 w-3" />
                            {pushTargetCandidates.find(t => t.id === field.push_target_field_id)?.name || (nextStage ? STAGE_LABEL[nextStage] + ' field' : 'next stage')}
                          </Badge>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                      )}
                    </div>
                    <Switch checked={field.is_active} onCheckedChange={() => handleToggleActive(field)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(field)} title="Edit field">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(field)}
                     title="Delete field">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              ))
            )}

            {adding ? (
              <FieldForm
                draft={draft}
                setDraft={setDraft}
                sourceFields={sourceCandidates()}
                toggleSource={toggleSource}
                onCancel={cancelForm}
                onSave={handleSave}
                saving={createField.isPending}
                isEditingComputedType={false}
                showPushTarget={showPushTarget}
                pushTargetCandidates={pushTargetCandidates}
                pipelineStage={pipelineStage}
                nextStageLabel={nextStage ? STAGE_LABEL[nextStage] : ''}
              />
            ) : (
              <>
                <Separator />
                <Button variant="outline" className="w-full" onClick={startAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {refsLoading ? (
                'Checking what else references this field…'
              ) : refs && (refs.computed_field_names.length > 0 || refs.mapping_names.length > 0) ? (
                <>
                  {refs.computed_field_names.length > 0 && (
                    <>This field is used by computed field(s) "{refs.computed_field_names.join('", "')}" —
                      they'll be recomputed without it. </>
                  )}
                  {refs.mapping_names.length > 0 && (
                    <>It's also referenced by saved mapping preset(s) "{refs.mapping_names.join('", "')}" —
                      it'll be removed from those too. </>
                  )}
                  Deleting still removes the field and every score recorded against it. This cannot be undone.
                </>
              ) : (
                'This deletes the field and every score recorded against it. This cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface FieldFormProps {
  draft: typeof emptyDraft;
  setDraft: React.Dispatch<React.SetStateAction<typeof emptyDraft>>;
  sourceFields: BroadsheetField[];
  toggleSource: (id: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  isEditingComputedType: boolean;
  /** Report Card fields never get a push target (no stage after it) — that
   * dialog passes false and the picker doesn't render. */
  showPushTarget: boolean;
  pushTargetCandidates: BroadsheetField[];
  /** The dialog's own stage — used to label cross-stage source chips and
   * to name the next stage in the push-target copy. */
  pipelineStage: 'pre_ca' | 'broadsheet';
  nextStageLabel: string;
}

function FieldForm({
  draft, setDraft, sourceFields, toggleSource, onCancel, onSave, saving, isEditingComputedType,
  showPushTarget, pushTargetCandidates, pipelineStage, nextStageLabel,
}: FieldFormProps) {
  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Quiz 1"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max Points</Label>
          <Input
            type="number"
            min={1}
            value={draft.max_points}
            onChange={(e) => setDraft(d => ({ ...d, max_points: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description (optional)</Label>
        <Input
          value={draft.description}
          onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
          placeholder="Shown as a hint when scoring"
        />
      </div>

      {/* Computed fields can't change type after creation — flipping a
          manual field to computed (or back) would orphan whatever scores
          were already entered directly against it. */}
      {!isEditingComputedType && (
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.is_computed}
            onCheckedChange={(checked) => setDraft(d => ({ ...d, is_computed: checked }))}
          />
          <Label className="!m-0">Computed field (auto-calculated from other fields)</Label>
        </div>
      )}

      {!draft.is_computed && (
        <div className="space-y-1.5">
          <Label>Entry Mode</Label>
          <p className="text-xs text-muted-foreground">
            Only matters once this stage is locked (toggle at the top) — until then, both are allowed.
          </p>
          <Select
            value={draft.entry_mode}
            onValueChange={(v) => setDraft(d => ({ ...d, entry_mode: v as 'manual' | 'push' }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual entry — teachers type scores in directly</SelectItem>
              <SelectItem value="push">Push-sourced — filled by a push, teachers can't type into it</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {draft.is_computed && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Operation</Label>
            <Select
              value={draft.formula_operation}
              onValueChange={(v) => setDraft(d => ({ ...d, formula_operation: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPERATIONS.map(op => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source Fields</Label>
            {sourceFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">Add another field first to use as a source.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sourceFields.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleSource(f.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1 ${
                      draft.formula_source_field_ids.includes(f.id)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {f.is_computed && <Sigma className="h-3 w-3" />}
                    {f.name}
                    {f.pipeline_stage !== pipelineStage && (
                      <span className="opacity-70">({STAGE_LABEL[f.pipeline_stage]})</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showPushTarget && (
        <div className="space-y-1.5 pt-1">
          <Label>Push Target (optional)</Label>
          <p className="text-xs text-muted-foreground">
            When you click "Push to {nextStageLabel}" on the {STAGE_LABEL[pipelineStage]} tab, this field's
            scores are copied into the {nextStageLabel} field picked here.
          </p>
          <Select
            value={draft.push_target_field_id ?? '__none__'}
            onValueChange={(v) => setDraft(d => ({ ...d, push_target_field_id: v === '__none__' ? null : v }))}
          >
            <SelectTrigger><SelectValue placeholder="No push target" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No push target</SelectItem>
              {pushTargetCandidates.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pushTargetCandidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No eligible {nextStageLabel} fields yet — add a (non-computed) one in the {nextStageLabel} tab's Manage Fields first.
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1.5" />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}

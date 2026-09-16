import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Sigma, Award } from 'lucide-react';
import {
  useBroadsheetFields, useToggleShowOnReportCard, useGradeSourceField, useSetGradeSourceField,
} from '@/hooks/useBroadsheetFields';

interface ManageReportCardVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Report Card no longer has its own field definitions — it mirrors
 * Broadsheet fields directly, ALL of them (including the legacy CA1/CA2/
 * CA3/Exam fields, which used to be separate hardcoded columns — that's
 * what caused fields to appear twice for schools that had also set up
 * their own equivalents as regular Broadsheet fields). This dialog is
 * deliberately NOT a CRUD dialog like ManagePipelineFieldsDialog: no add/
 * edit/delete/reorder, no compute/source configuration (that's all
 * inherited from how the field is already set up in Broadsheet). Two
 * decisions live here: which fields show as columns, and which one field
 * (at most) represents a subject's final score for computing Grade and
 * feeding Transcript.
 */
export function ManageReportCardVisibilityDialog({ open, onOpenChange }: ManageReportCardVisibilityDialogProps) {
  const { data: allFields = [], isLoading } = useBroadsheetFields('broadsheet');
  const toggle = useToggleShowOnReportCard();
  const { data: gradeSourceField } = useGradeSourceField();
  const setGradeSource = useSetGradeSourceField();

  const fields = allFields
    .filter(f => !f.is_locked)
    .sort((a, b) => (a.field_order ?? 0) - (b.field_order ?? 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Report Card Fields</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          These are your school's Broadsheet fields. Flip a field on to show it as a column on the Report
          Card and Transcript. Pick one field (usually a "Total") as the <span className="inline-flex items-center gap-0.5 font-medium"><Award className="h-3 w-3" />grade source</span> — its
          per-subject score is what computes the Grade badge and feeds Transcript's total/average/position.
          To add, edit, or change how a field is scored, use Broadsheet's own Manage Fields.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No Broadsheet fields exist yet — set some up in the Broadsheet tab first.
          </p>
        ) : (
          <div className="space-y-2">
            {fields.map(field => (
              <div key={field.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
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
                    </div>
                    {field.description && (
                      <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">Show</span>
                    <Switch
                      checked={field.show_on_report_card}
                      onCheckedChange={(checked) => toggle.mutate({ fieldId: field.id, show: checked })}
                      disabled={toggle.isPending}
                    />
                  </div>
                </div>
                <Separator />
                <button
                  type="button"
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5 ${
                    field.is_grade_source
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
                  }`}
                  disabled={setGradeSource.isPending}
                  onClick={() => setGradeSource.mutate(field.is_grade_source ? null : field.id)}
                >
                  <Award className="h-3.5 w-3.5" />
                  {field.is_grade_source ? 'Grade source — click to unset' : 'Use as grade source'}
                </button>
              </div>
            ))}
          </div>
        )}

        {!gradeSourceField && !isLoading && fields.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-500">
            No grade source set — Grade badges and Transcript totals will fall back to the old CA1-3/Exam
            calculation, which only works if your school still enters scores into those specific fields.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare } from 'lucide-react';
import { useSaveTranscript, type StudentReportCard } from '@/hooks/useResults';

interface RemarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportCard: StudentReportCard;
  canEditPrincipalRemarks: boolean;
}

/**
 * The PDF has always rendered class-teacher/principal remarks — the gap was
 * that nothing in the app ever called useSaveTranscript with actual remarks
 * text, so the field silently stayed empty. This is that missing entry point.
 */
export function RemarksDialog({ open, onOpenChange, reportCard, canEditPrincipalRemarks }: RemarksDialogProps) {
  const [classTeacherRemarks, setClassTeacherRemarks] = useState('');
  const [principalRemarks, setPrincipalRemarks] = useState('');
  const saveTranscript = useSaveTranscript();

  useEffect(() => {
    if (open) {
      setClassTeacherRemarks(reportCard.remarks.class_teacher || '');
      setPrincipalRemarks(reportCard.remarks.principal || '');
    }
  }, [open, reportCard]);

  const handleSave = async () => {
    await saveTranscript.mutateAsync({
      student_id: reportCard.student.id,
      session_id: reportCard.session.id,
      term_id: reportCard.term.id,
      total_subjects: reportCard.subjects.length,
      total_score: reportCard.summary.total_score,
      average_score: reportCard.summary.average_score,
      position: reportCard.summary.position,
      class_size: reportCard.summary.class_size,
      class_teacher_remarks: classTeacherRemarks || undefined,
      principal_remarks: canEditPrincipalRemarks ? (principalRemarks || undefined) : (reportCard.remarks.principal || undefined),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-secondary" />
            Report Card Remarks
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Class Teacher's Remarks</Label>
            <Textarea
              value={classTeacherRemarks}
              onChange={(e) => setClassTeacherRemarks(e.target.value)}
              placeholder="e.g. A diligent student who participates actively in class..."
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label>Principal's Remarks {!canEditPrincipalRemarks && <span className="text-xs text-muted-foreground">(Admin/Principal only)</span>}</Label>
            <Textarea
              value={principalRemarks}
              onChange={(e) => setPrincipalRemarks(e.target.value)}
              placeholder="e.g. Keep up the good work..."
              rows={3}
              maxLength={500}
              disabled={!canEditPrincipalRemarks}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveTranscript.isPending}>
            {saveTranscript.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Remarks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

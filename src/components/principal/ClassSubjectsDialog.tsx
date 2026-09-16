import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubjects, useClassSubjects, useRemoveClassSubject } from '@/hooks/useSubjects';
import { X, BookOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ClassSubjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string | null;
  className: string;
}

export function ClassSubjectsDialog({ 
  open, 
  onOpenChange, 
  classId,
  className 
}: ClassSubjectsDialogProps) {
  const { data: subjects = [] } = useSubjects();
  const { data: classSubjects = [], isLoading } = useClassSubjects();
  const removeClassSubject = useRemoveClassSubject();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const assignedSubjects = classSubjects
    .filter(cs => cs.class_id === classId)
    .map(cs => ({
      ...cs,
      subject: subjects.find(s => s.id === cs.subject_id),
    }))
    .filter(cs => cs.subject);

  const handleRemoveSubject = async (classSubjectId: string, subjectName: string) => {
    setRemovingId(classSubjectId);
    try {
      await removeClassSubject.mutateAsync(classSubjectId);
      toast.success(`${subjectName} removed from ${className}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove subject');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Subjects - {className}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assignedSubjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No subjects assigned to this class yet.
            </div>
          ) : (
            <div className="space-y-2">
              {assignedSubjects.map((cs) => (
                <div 
                  key={cs.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {cs.subject?.code}
                    </Badge>
                    <span className="font-medium text-foreground">
                      {cs.subject?.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveSubject(cs.id, cs.subject?.name || '')}
                    disabled={removingId === cs.id}
                   title="Remove subject">
                    {removingId === cs.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {assignedSubjects.length} subject{assignedSubjects.length !== 1 ? 's' : ''} assigned
        </div>
      </DialogContent>
    </Dialog>
  );
}

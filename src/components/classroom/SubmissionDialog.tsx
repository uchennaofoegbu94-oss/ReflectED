import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCreateSubmission, useMySubmission } from '@/hooks/useSubmissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2,
  Upload,
  Paperclip,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface SubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: {
    id: string;
    title: string;
    instructions?: string | null;
    due_date?: string | null;
    due_time?: string | null;
    points?: number | null;
    allow_late_submission?: boolean | null;
  };
}

export function SubmissionDialog({ open, onOpenChange, assignment }: SubmissionDialogProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: 'file' | 'link' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existingSubmission, isLoading: loadingSubmission } = useMySubmission(assignment.id);
  const createSubmission = useCreateSubmission();

  const isOverdue = assignment.due_date
    ? new Date() > new Date(`${assignment.due_date}T${assignment.due_time || '23:59:59'}`)
    : false;

  const canEditExistingSubmission = !!existingSubmission && existingSubmission.status !== 'graded';

  useEffect(() => {
    if (!open) {
      setContent('');
      setAttachments([]);
      setIsEditingExisting(false);
      return;
    }

    setContent(existingSubmission?.content || '');
    setAttachments([]);
    setIsEditingExisting(false);
  }, [open, existingSubmission]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!user) {
      toast.error('You must be logged in to upload files');
      return;
    }

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${fileExt}`;
        const filePath = `submissions/${assignment.id}/${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('classroom-materials')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('classroom-materials')
          .getPublicUrl(filePath);

        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            url: urlData.publicUrl,
            type: 'file',
          },
        ]);
      }
      toast.success('File(s) uploaded');
    } catch (error: any) {
      toast.error('Failed to upload: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && attachments.length === 0 && !existingSubmission?.attachments?.length) {
      toast.error('Please add content or attach files');
      return;
    }

    await createSubmission.mutateAsync({
      assignmentId: assignment.id,
      content: content.trim() || undefined,
      attachments: attachments.map((attachment) => ({ ...attachment, type: attachment.type as any })),
    });

    setContent('');
    setAttachments([]);
    setIsEditingExisting(false);
    onOpenChange(false);
  };

  if (loadingSubmission) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-secondary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (existingSubmission && !isEditingExisting) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                <CheckCircle size={14} className="mr-1" />
                {existingSubmission.status === 'graded' ? 'Graded' : 'Submitted'}
              </Badge>
              {existingSubmission.is_late && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  <Clock size={14} className="mr-1" />
                  Late
                </Badge>
              )}
              {existingSubmission.status === 'graded' && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Graded: {existingSubmission.grade}/{assignment.points || 100}
                </Badge>
              )}
            </div>

            <div>
              <Label className="text-muted-foreground">Submitted on</Label>
              <p className="text-foreground">
                {new Date(existingSubmission.submitted_at).toLocaleString()}
              </p>
            </div>

            {existingSubmission.content && (
              <div>
                <Label className="text-muted-foreground">Your Work</Label>
                <p className="text-foreground mt-1 whitespace-pre-wrap p-3 bg-muted rounded-lg">
                  {existingSubmission.content}
                </p>
              </div>
            )}

            {existingSubmission.attachments && existingSubmission.attachments.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Attachments</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {existingSubmission.attachments.map((att: any) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors"
                    >
                      <Paperclip size={14} />
                      {att.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {existingSubmission.feedback && (
              <div>
                <Label className="text-muted-foreground">Teacher Feedback</Label>
                <p className="text-foreground mt-1 p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                  {existingSubmission.feedback}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEditExistingSubmission && (
              <Button className="btn-accent" onClick={() => setIsEditingExisting(true)}>
                Update Submission
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingSubmission ? 'Update Submission' : 'Submit Assignment'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <h3 className="font-medium text-foreground">{assignment.title}</h3>
            {assignment.instructions && (
              <p className="text-sm text-muted-foreground mt-1">{assignment.instructions}</p>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm">
            {assignment.due_date && (
              <div className="flex items-center gap-1">
                <Clock size={14} className={isOverdue ? 'text-destructive' : 'text-muted-foreground'} />
                <span className={isOverdue ? 'text-destructive' : 'text-muted-foreground'}>
                  Due: {new Date(assignment.due_date).toLocaleDateString()}
                  {assignment.due_time && ` at ${assignment.due_time}`}
                </span>
              </div>
            )}
            {assignment.points && (
              <span className="text-muted-foreground">{assignment.points} points</span>
            )}
          </div>

          {existingSubmission && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <AlertCircle size={16} />
              <span>
                Re-submitting will update your text and add any new files while keeping your existing attachments.
              </span>
            </div>
          )}

          {isOverdue && !assignment.allow_late_submission && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
              <AlertCircle size={16} />
              <span>This assignment is past due and doesn't accept late submissions.</span>
            </div>
          )}

          {isOverdue && assignment.allow_late_submission && (
            <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg text-warning text-sm">
              <AlertCircle size={16} />
              <span>This assignment is past due. Your submission will be marked as late.</span>
            </div>
          )}

          <div>
            <Label>Your Work</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your answer or add a note about your submission..."
              className="mt-2 min-h-[100px]"
            />
          </div>

          {existingSubmission?.attachments && existingSubmission.attachments.length > 0 && (
            <div>
              <Label>Current Attachments</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {existingSubmission.attachments.map((att: any) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors"
                  >
                    <Paperclip size={14} />
                    {att.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>{existingSubmission ? 'Add More Attachments' : 'Attachments'}</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
            />
            <Button
              variant="outline"
              className="w-full mt-2 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Upload Files
            </Button>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                    <Paperclip size={14} />
                    <span className="max-w-[150px] truncate">{att.name}</span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createSubmission.isPending || (isOverdue && !assignment.allow_late_submission)}
            className="btn-accent"
          >
            {createSubmission.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {existingSubmission ? 'Update Submission' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

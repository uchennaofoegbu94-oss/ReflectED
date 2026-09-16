import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLinkChild } from '@/hooks/useParentChildren';
import { Loader2, UserPlus } from 'lucide-react';

interface ConnectChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectChildDialog({ open, onOpenChange }: ConnectChildDialogProps) {
  const [admissionNumber, setAdmissionNumber] = useState('');
  const linkChild = useLinkChild();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionNumber.trim()) return;

    try {
      await linkChild.mutateAsync(admissionNumber.trim());
      setAdmissionNumber('');
      onOpenChange(false);
    } catch {
      // error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={20} />
            Connect Child
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Student Admission Number</Label>
            <Input
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
              placeholder="e.g., STU-123456"
            />
            <p className="text-xs text-muted-foreground">
              Enter your child's admission number to link their account to yours.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={linkChild.isPending || !admissionNumber.trim()}>
              {linkChild.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

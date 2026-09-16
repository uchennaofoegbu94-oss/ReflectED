import { useState } from 'react';
import { EventWithDetails, useTransferCoordinator } from '@/hooks/useEvents';
import { useStaff } from '@/hooks/useStaff';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users } from 'lucide-react';

interface TransferCoordinatorDialogProps {
  event: EventWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferCoordinatorDialog({
  event,
  open,
  onOpenChange,
}: TransferCoordinatorDialogProps) {
  const { data: staff } = useStaff();
  const transferCoordinator = useTransferCoordinator();

  const [newCoordinatorId, setNewCoordinatorId] = useState('');

  const handleTransfer = async () => {
    if (!event || !newCoordinatorId) return;

    await transferCoordinator.mutateAsync({
      eventId: event.id,
      newCoordinatorId,
    });

    onOpenChange(false);
    setNewCoordinatorId('');
  };

  if (!event) return null;

  // Filter out current coordinator
  const availableStaff = staff?.filter((s) => s.id !== event.coordinator_id) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-secondary" />
            Transfer Coordinator
          </DialogTitle>
          <DialogDescription>
            Transfer coordination responsibilities for "{event.title}" to another staff member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Current Coordinator: </span>
              <span className="font-medium">
                {event.coordinator
                  ? `${event.coordinator.first_name} ${event.coordinator.last_name}`
                  : 'N/A'}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newCoordinator">New Coordinator</Label>
            <Select value={newCoordinatorId} onValueChange={setNewCoordinatorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select new coordinator" />
              </SelectTrigger>
              <SelectContent>
                {availableStaff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={transferCoordinator.isPending || !newCoordinatorId}
          >
            {transferCoordinator.isPending ? 'Transferring...' : 'Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

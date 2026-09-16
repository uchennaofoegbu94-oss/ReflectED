import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EventWithDetails, useSupportEvent } from '@/hooks/useEvents';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heart, Calendar, MapPin } from 'lucide-react';

interface SupportEventDialogProps {
  event: EventWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const supportTypes = [
  { value: 'volunteer', label: 'Volunteer Time' },
  { value: 'donation', label: 'Donation' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'supplies', label: 'Provide Supplies' },
  { value: 'transportation', label: 'Transportation Help' },
  { value: 'other', label: 'Other Support' },
];

export function SupportEventDialog({ event, open, onOpenChange }: SupportEventDialogProps) {
  const { user } = useAuth();
  const supportEvent = useSupportEvent();

  const [supportType, setSupportType] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!event || !user) return;

    await supportEvent.mutateAsync({
      eventId: event.id,
      userId: user.id,
      supportType: supportType || undefined,
      notes: notes || undefined,
    });

    onOpenChange(false);
    setSupportType('');
    setNotes('');
  };

  if (!event) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Support Event
          </DialogTitle>
          <DialogDescription>
            Show your support for "{event.title}" by volunteering or contributing.
          </DialogDescription>
        </DialogHeader>

        {/* Event Summary */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <h4 className="font-medium">{event.title}</h4>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {formatDate(event.event_date)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {event.location}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supportType">How would you like to help?</Label>
            <Select value={supportType} onValueChange={setSupportType}>
              <SelectTrigger>
                <SelectValue placeholder="Select support type" />
              </SelectTrigger>
              <SelectContent>
                {supportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Share any details about your support..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={supportEvent.isPending} className="gap-2">
              <Heart size={16} />
              {supportEvent.isPending ? 'Submitting...' : 'Confirm Support'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

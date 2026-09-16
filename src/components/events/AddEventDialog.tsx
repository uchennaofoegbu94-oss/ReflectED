import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateEvent, useUpdateEvent, EventWithDetails } from '@/hooks/useEvents';
import { useCanPostAnnouncements, useCreateAnnouncement } from '@/hooks/useSchoolAnnouncements';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEvent?: EventWithDetails | null;
}

const eventTypes = [
  { value: 'event', label: 'General Event' },
  { value: 'exam', label: 'Examination' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'sports', label: 'Sports' },
  { value: 'cultural', label: 'Cultural' },
];

export function AddEventDialog({ open, onOpenChange, editingEvent }: AddEventDialogProps) {
  const { user } = useAuth();
  const { data: staff } = useStaff();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const { data: canPostAnnouncement } = useCanPostAnnouncements();
  const createAnnouncement = useCreateAnnouncement();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('event');
  const [alsoAnnounce, setAlsoAnnounce] = useState(false);

  // Find current user's staff record
  const currentStaff = staff?.find(s => s.user_id === user?.id);

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setDescription(editingEvent.description || '');
      setEventDate(editingEvent.event_date);
      setEventTime(editingEvent.event_time || '');
      setLocation(editingEvent.location || '');
      setType(editingEvent.type);
    } else {
      resetForm();
    }
  }, [editingEvent, open]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventDate('');
    setEventTime('');
    setLocation('');
    setType('event');
    setAlsoAnnounce(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentStaff && !editingEvent) {
      return;
    }

    if (editingEvent) {
      await updateEvent.mutateAsync({
        id: editingEvent.id,
        title,
        description: description || null,
        event_date: eventDate,
        event_time: eventTime || null,
        location: location || null,
        type,
      });
    } else {
      await createEvent.mutateAsync({
        title,
        description: description || undefined,
        event_date: eventDate,
        event_time: eventTime || undefined,
        location: location || undefined,
        type,
        coordinator_id: currentStaff!.id,
        created_by: user!.id,
      });

      if (alsoAnnounce && canPostAnnouncement) {
        await createAnnouncement.mutateAsync({
          title: `New Event: ${title}`,
          content: description || `Join us for ${title} on ${eventDate}${location ? ` at ${location}` : ''}.`,
          announcement_type: 'notice',
          priority: 'normal',
        });
      }
    }

    onOpenChange(false);
    resetForm();
  };

  const isLoading = createEvent.isPending || updateEvent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
          <DialogDescription>
            {editingEvent
              ? 'Update the event details below.'
              : 'Fill in the details to create a new event. You will be assigned as the coordinator.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Event Type *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventDate">Date *</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventTime">Time</Label>
              <Input
                id="eventTime"
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter event location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter event description"
              rows={3}
            />
          </div>

          {!editingEvent && canPostAnnouncement && (
            <div className="flex items-center gap-2 rounded-md border p-3">
              <Checkbox
                id="also-announce"
                checked={alsoAnnounce}
                onCheckedChange={(checked) => setAlsoAnnounce(checked === true)}
              />
              <Label htmlFor="also-announce" className="text-sm font-normal cursor-pointer">
                Also post this as a school announcement
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title || !eventDate}>
              {isLoading ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

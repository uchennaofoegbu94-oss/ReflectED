import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { EventWithDetails, useJoinEvent, useLeaveEvent, useEventParticipants } from '@/hooks/useEvents';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, UserCheck, UserMinus } from 'lucide-react';

interface ParticipateEventDialogProps {
  event: EventWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ParticipateEventDialog({ event, open, onOpenChange }: ParticipateEventDialogProps) {
  const { user } = useAuth();
  const joinEvent = useJoinEvent();
  const leaveEvent = useLeaveEvent();
  const { data: participants } = useEventParticipants(event?.id || '');

  const [studentId, setStudentId] = useState<string | null>(null);
  const [isParticipating, setIsParticipating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch student record for current user
  useEffect(() => {
    const fetchStudentId = async () => {
      if (!user) return;

      setLoading(true);
      const { data } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setStudentId(data.id);
      }
      setLoading(false);
    };

    if (open) {
      fetchStudentId();
    }
  }, [user, open]);

  // Check if already participating
  useEffect(() => {
    if (studentId && participants) {
      const participating = participants.some((p) => p.student_id === studentId);
      setIsParticipating(participating);
    }
  }, [studentId, participants]);

  const handleJoin = async () => {
    if (!event || !studentId) return;

    await joinEvent.mutateAsync({
      eventId: event.id,
      studentId,
    });

    onOpenChange(false);
  };

  const handleLeave = async () => {
    if (!event || !studentId) return;

    await leaveEvent.mutateAsync({
      eventId: event.id,
      studentId,
    });

    onOpenChange(false);
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

  const isLoading = joinEvent.isPending || leaveEvent.isPending || loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-secondary" />
            {isParticipating ? 'Leave Event' : 'Join Event'}
          </DialogTitle>
          <DialogDescription>
            {isParticipating
              ? `You are currently registered for "${event.title}".`
              : `Register to participate in "${event.title}".`}
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
          {event.description && (
            <p className="text-sm text-muted-foreground mt-2">{event.description}</p>
          )}
        </div>

        {!studentId && !loading && (
          <p className="text-sm text-destructive">
            Unable to find your student record. Please contact administration.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isParticipating ? (
            <Button
              onClick={handleLeave}
              disabled={isLoading || !studentId}
              variant="destructive"
              className="gap-2"
            >
              <UserMinus size={16} />
              {leaveEvent.isPending ? 'Leaving...' : 'Leave Event'}
            </Button>
          ) : (
            <Button onClick={handleJoin} disabled={isLoading || !studentId} className="gap-2">
              <UserCheck size={16} />
              {joinEvent.isPending ? 'Joining...' : 'Join Event'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

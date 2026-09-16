import { useAuth } from '@/contexts/AuthContext';
import { EventWithDetails, useEventParticipants, useEventSupporters } from '@/hooks/useEvents';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar, Clock, MapPin, User, Users, Heart } from 'lucide-react';

interface ViewEventDialogProps {
  event: EventWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const eventTypeColors: Record<string, string> = {
  exam: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  meeting: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  event: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  sports: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  cultural: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export function ViewEventDialog({ event, open, onOpenChange }: ViewEventDialogProps) {
  const { user } = useAuth();
  const { data: participants } = useEventParticipants(event?.id || '');
  const { data: supporters } = useEventSupporters(event?.id || '');

  const isStaff = ['admin', 'principal', 'teacher', 'accountant'].includes(user?.role || '');

  if (!event) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '';
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <DialogTitle className="text-xl">{event.title}</DialogTitle>
            <Badge className={eventTypeColors[event.type] || eventTypeColors.event}>
              {event.type}
            </Badge>
          </div>
          <DialogDescription className="sr-only">Event details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Event Details */}
          <div className="grid gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(event.event_date)}</span>
            </div>
            {event.event_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatTime(event.event_time)}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>
                Coordinator:{' '}
                {event.coordinator
                  ? `${event.coordinator.first_name} ${event.coordinator.last_name}`
                  : 'N/A'}
              </span>
            </div>
          </div>

          {event.description && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm">{event.description}</p>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-secondary" />
              <span>{participants?.length || 0} Participants</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-red-500" />
              <span>{supporters?.length || 0} Supporters</span>
            </div>
          </div>

          {/* Participants and Supporters tabs (visible to coordinators/staff) */}
          {isStaff && (
            <Tabs defaultValue="participants" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="participants">Participants</TabsTrigger>
                <TabsTrigger value="supporters">Supporters</TabsTrigger>
              </TabsList>

              <TabsContent value="participants">
                <ScrollArea className="h-[200px] rounded-md border p-4">
                  {participants && participants.length > 0 ? (
                    <div className="space-y-3">
                      {participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center gap-3 rounded-lg border p-2"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {participant.student?.first_name?.[0]}
                              {participant.student?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {participant.student?.first_name} {participant.student?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {participant.student?.admission_number}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No participants yet
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="supporters">
                <ScrollArea className="h-[200px] rounded-md border p-4">
                  {supporters && supporters.length > 0 ? (
                    <div className="space-y-3">
                      {supporters.map((supporter) => (
                        <div
                          key={supporter.id}
                          className="flex items-center gap-3 rounded-lg border p-2"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {supporter.profile?.full_name?.[0] || 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {supporter.profile?.full_name || 'Supporter'}
                            </p>
                            {supporter.support_type && (
                              <Badge variant="outline" className="text-xs">
                                {supporter.support_type}
                              </Badge>
                            )}
                            {supporter.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {supporter.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No supporters yet
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

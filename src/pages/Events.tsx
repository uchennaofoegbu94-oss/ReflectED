import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEvents, useDeleteEvent, EventWithDetails } from '@/hooks/useEvents';
import { useStaff } from '@/hooks/useStaff';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Clock,
  MapPin,
  MoreVertical,
  Plus,
  Users,
  Heart,
  Eye,
  Pencil,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { AddEventDialog } from '@/components/events/AddEventDialog';
import { ViewEventDialog } from '@/components/events/ViewEventDialog';
import { SupportEventDialog } from '@/components/events/SupportEventDialog';
import { ParticipateEventDialog } from '@/components/events/ParticipateEventDialog';
import { TransferCoordinatorDialog } from '@/components/events/TransferCoordinatorDialog';

const eventTypeColors: Record<string, string> = {
  exam: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  meeting: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  event: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  sports: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  cultural: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function Events() {
  const { user } = useAuth();
  const { data: events, isLoading } = useEvents();
  const { data: staff } = useStaff();
  const deleteEvent = useDeleteEvent();

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithDetails | null>(null);
  const [viewingEvent, setViewingEvent] = useState<EventWithDetails | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventWithDetails | null>(null);
  const [supportingEvent, setSupportingEvent] = useState<EventWithDetails | null>(null);
  const [participatingEvent, setParticipatingEvent] = useState<EventWithDetails | null>(null);
  const [transferringEvent, setTransferringEvent] = useState<EventWithDetails | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const isStaff = ['admin', 'principal', 'teacher', 'accountant'].includes(user?.role || '');
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';

  const canManageEvent = (event: EventWithDetails) => {
    if (isAdmin) return true;
    // Find staff record for current user
    const currentStaff = staff?.find(s => s.user_id === user?.id);
    return currentStaff?.id === event.coordinator_id;
  };

  const handleDelete = () => {
    if (deletingEvent) {
      deleteEvent.mutate(deletingEvent.id);
      setDeletingEvent(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      weekday: 'short',
      month: 'short',
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">Events</h1>
          <p className="text-muted-foreground mt-1">
            {isStaff
              ? 'Manage school events and activities'
              : 'View and participate in school events'}
          </p>
        </div>
        {isStaff && (
          <Button className="btn-accent gap-2" onClick={() => setAddEventOpen(true)}>
            <Plus size={18} />
            Create Event
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">All Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Coordinator</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Supporters</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{event.title}</span>
                          <Badge className={eventTypeColors[event.type] || eventTypeColors.event}>
                            {event.type}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {formatDate(event.event_date)}
                          </span>
                          {event.event_time && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock size={14} />
                              {formatTime(event.event_time)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.location && (
                          <span className="flex items-center gap-1 text-sm">
                            <MapPin size={14} />
                            {event.location}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {event.coordinator
                          ? `${event.coordinator.first_name} ${event.coordinator.last_name}`
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Users size={14} />
                          {event.participants_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Heart size={14} />
                          {event.supporters_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" title="More options">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewingEvent(event)}>
                              <Eye size={14} className="mr-2" />
                              View Details
                            </DropdownMenuItem>
                            
                            {isStudent && (
                              <DropdownMenuItem onClick={() => setParticipatingEvent(event)}>
                                <UserCheck size={14} className="mr-2" />
                                Participate
                              </DropdownMenuItem>
                            )}
                            
                            {isParent && (
                              <DropdownMenuItem onClick={() => setSupportingEvent(event)}>
                                <Heart size={14} className="mr-2" />
                                Support Event
                              </DropdownMenuItem>
                            )}

                            {canManageEvent(event) && (
                              <>
                                <DropdownMenuItem onClick={() => setEditingEvent(event)}>
                                  <Pencil size={14} className="mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTransferringEvent(event)}>
                                  <Users size={14} className="mr-2" />
                                  Transfer Coordinator
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeletingEvent(event)}
                                  className="text-destructive"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">No events yet</h3>
              <p className="text-muted-foreground mt-1">
                {isStaff ? 'Create your first event to get started' : 'Check back later for upcoming events'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Event Dialog */}
      <AddEventDialog
        open={addEventOpen || !!editingEvent}
        onOpenChange={(open) => {
          if (!open) {
            setAddEventOpen(false);
            setEditingEvent(null);
          }
        }}
        editingEvent={editingEvent}
      />

      {/* View Event Dialog */}
      <ViewEventDialog
        event={viewingEvent}
        open={!!viewingEvent}
        onOpenChange={(open) => !open && setViewingEvent(null)}
      />

      {/* Support Event Dialog (for parents) */}
      <SupportEventDialog
        event={supportingEvent}
        open={!!supportingEvent}
        onOpenChange={(open) => !open && setSupportingEvent(null)}
      />

      {/* Participate Event Dialog (for students) */}
      <ParticipateEventDialog
        event={participatingEvent}
        open={!!participatingEvent}
        onOpenChange={(open) => !open && setParticipatingEvent(null)}
      />

      {/* Transfer Coordinator Dialog */}
      <TransferCoordinatorDialog
        event={transferringEvent}
        open={!!transferringEvent}
        onOpenChange={(open) => !open && setTransferringEvent(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingEvent?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

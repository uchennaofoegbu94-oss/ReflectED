import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Video, Calendar, Clock, ExternalLink, Loader2, Edit2, Trash2, Play, XCircle } from 'lucide-react';
import { useLiveClasses, useCreateLiveClass, useUpdateLiveClass, useDeleteLiveClass } from '@/hooks/useClassroomManagement';
import { format, parseISO, isPast, isFuture, isToday } from 'date-fns';

interface LiveClassTabProps {
  classroomId: string;
  isTeacher: boolean;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  live: 'bg-green-500/10 text-green-600 border-green-500/30 animate-pulse',
  ended: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function LiveClassTab({ classroomId, isTeacher }: LiveClassTabProps) {
  const { data: liveClasses = [], isLoading } = useLiveClasses(classroomId);
  const createLiveClass = useCreateLiveClass();
  const updateLiveClass = useUpdateLiveClass();
  const deleteLiveClass = useDeleteLiveClass();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration_minutes: '60',
    meeting_link: '',
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '',
      duration_minutes: '60',
      meeting_link: '',
    });
    setEditingSession(null);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.date || !formData.time) return;

    const scheduled_at = `${formData.date}T${formData.time}:00`;

    if (editingSession) {
      await updateLiveClass.mutateAsync({
        id: editingSession.id,
        classroomId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        scheduled_at,
        duration_minutes: parseInt(formData.duration_minutes) || 60,
        meeting_link: formData.meeting_link.trim() || undefined,
      });
    } else {
      await createLiveClass.mutateAsync({
        classroom_id: classroomId,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        scheduled_at,
        duration_minutes: parseInt(formData.duration_minutes) || 60,
        meeting_link: formData.meeting_link.trim() || undefined,
      });
    }

    setShowAddDialog(false);
    resetForm();
  };

  const handleEdit = (session: any) => {
    const scheduledDate = parseISO(session.scheduled_at);
    setEditingSession(session);
    setFormData({
      title: session.title || '',
      description: session.description || '',
      date: format(scheduledDate, 'yyyy-MM-dd'),
      time: format(scheduledDate, 'HH:mm'),
      duration_minutes: session.duration_minutes?.toString() || '60',
      meeting_link: session.meeting_link || '',
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to cancel this live class?')) {
      await deleteLiveClass.mutateAsync({ id, classroomId });
    }
  };

  const handleStatusChange = async (id: string, status: 'live' | 'ended' | 'cancelled') => {
    await updateLiveClass.mutateAsync({ id, classroomId, status });
  };

  const upcomingSessions = liveClasses.filter(
    (s: any) => (s.status === 'scheduled' || s.status === 'live') && isFuture(parseISO(s.scheduled_at))
  );
  const todaySessions = liveClasses.filter(
    (s: any) => isToday(parseISO(s.scheduled_at)) && s.status !== 'cancelled'
  );
  const pastSessions = liveClasses.filter(
    (s: any) => isPast(parseISO(s.scheduled_at)) || s.status === 'ended'
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold font-display">Live Classes</h2>
          <p className="text-sm text-muted-foreground">Schedule and join live video sessions</p>
        </div>
        {isTeacher && (
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-accent gap-2">
                <Plus size={18} />
                Schedule Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSession ? 'Edit Live Class' : 'Schedule Live Class'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Chapter 5 Review Session"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What will be covered in this session?"
                    className="min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  <div>
                    <Label>Time *</Label>
                    <Input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Duration</Label>
                  <Select 
                    value={formData.duration_minutes} 
                    onValueChange={(value) => setFormData({ ...formData, duration_minutes: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Meeting Link</Label>
                  <Input
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    placeholder="https://meet.google.com/... or Zoom link"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a Google Meet, Zoom, or other video conferencing link
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!formData.title.trim() || !formData.date || !formData.time || createLiveClass.isPending || updateLiveClass.isPending}
                >
                  {(createLiveClass.isPending || updateLiveClass.isPending) && (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  )}
                  {editingSession ? 'Update' : 'Schedule'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Today's Classes */}
      {todaySessions.length > 0 && (
        <Card className="border-secondary">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Video size={18} className="text-secondary" />
              Today's Classes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todaySessions.map((session: any) => (
              <LiveClassCard
                key={session.id}
                session={session}
                isTeacher={isTeacher}
                onEdit={() => handleEdit(session)}
                onDelete={() => handleDelete(session.id)}
                onStatusChange={(status) => handleStatusChange(session.id, status)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Classes */}
      {upcomingSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Upcoming</h3>
          <div className="space-y-3">
            {upcomingSessions.map((session: any) => (
              <LiveClassCard
                key={session.id}
                session={session}
                isTeacher={isTeacher}
                onEdit={() => handleEdit(session)}
                onDelete={() => handleDelete(session.id)}
                onStatusChange={(status) => handleStatusChange(session.id, status)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Classes */}
      {pastSessions.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3 text-muted-foreground">Past Sessions</h3>
          <div className="space-y-3">
            {pastSessions.slice(0, 5).map((session: any) => (
              <LiveClassCard
                key={session.id}
                session={session}
                isTeacher={isTeacher}
                isPast
                onEdit={() => handleEdit(session)}
                onDelete={() => handleDelete(session.id)}
                onStatusChange={(status) => handleStatusChange(session.id, status)}
              />
            ))}
          </div>
        </div>
      )}

      {liveClasses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isTeacher ? 'Schedule your first live class session.' : 'No live classes scheduled yet.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface LiveClassCardProps {
  session: any;
  isTeacher: boolean;
  isPast?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: 'live' | 'ended' | 'cancelled') => void;
}

function LiveClassCard({ session, isTeacher, isPast, onEdit, onDelete, onStatusChange }: LiveClassCardProps) {
  const scheduledDate = parseISO(session.scheduled_at);
  
  return (
    <Card className={isPast ? 'opacity-60' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-secondary/10 text-secondary">
              <span className="text-xs font-medium">
                {format(scheduledDate, 'MMM')}
              </span>
              <span className="text-lg font-bold">
                {format(scheduledDate, 'd')}
              </span>
            </div>
            <div>
              <h4 className="font-medium text-foreground">{session.title}</h4>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {format(scheduledDate, 'h:mm a')}
                </span>
                <span>•</span>
                <span>{session.duration_minutes} min</span>
              </div>
              {session.description && (
                <p className="text-sm text-muted-foreground mt-2">{session.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[session.status] || statusColors.scheduled}>
              {session.status === 'live' && <span className="mr-1">●</span>}
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          {session.meeting_link ? (
            <a
              href={session.meeting_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-secondary hover:underline text-sm"
            >
              <ExternalLink size={14} />
              Join Meeting
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">No meeting link added</span>
          )}

          {isTeacher && !isPast && (
            <div className="flex gap-2">
              {session.status === 'scheduled' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="gap-1 text-green-600"
                  onClick={() => onStatusChange('live')}
                >
                  <Play size={14} />
                  Start
                </Button>
              )}
              {session.status === 'live' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onStatusChange('ended')}
                >
                  End Class
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Edit2 size={14} />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

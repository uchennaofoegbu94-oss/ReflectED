import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Megaphone, Plus, Pencil, Trash2, Settings2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAllSchoolAnnouncements, useCanPostAnnouncements, useCreateAnnouncement,
  useUpdateAnnouncement, useDeleteAnnouncement, useTogglePermittedAnnouncer,
  SchoolAnnouncement,
} from '@/hooks/useSchoolAnnouncements';
import { useTeachers } from '@/hooks/useStaff';
import { formatDistanceToNow } from 'date-fns';

const emptyForm = {
  title: '', content: '', announcement_type: 'notice' as const, priority: 'normal' as const,
};

export function AnnouncementsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const { data: canPost } = useCanPostAnnouncements();
  const { data: announcements = [], isLoading } = useAllSchoolAnnouncements();
  const { data: teachers = [] } = useTeachers();

  const [composeOpen, setComposeOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolAnnouncement | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const togglePermitted = useTogglePermittedAnnouncer();

  // Not everyone needs to see this panel at all — if a teacher has no
  // posting permission, there's nothing for them to manage here (they
  // already see announcements via the banner on every page).
  if (!canPost && !isAdmin) return null;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setComposeOpen(true);
  };

  const openEdit = (a: SchoolAnnouncement) => {
    setEditing(a);
    setForm({ title: a.title, content: a.content, announcement_type: a.announcement_type, priority: a.priority });
    setComposeOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (editing) {
      await updateAnnouncement.mutateAsync({ id: editing.id, ...form });
    } else {
      await createAnnouncement.mutateAsync(form);
    }
    setComposeOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          School Announcements
        </CardTitle>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="h-4 w-4" /> Who Can Post
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Teachers permitted to post announcements</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Admins and principals can always post. Grant specific teachers the same ability here.
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {teachers.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="text-sm">{t.first_name} {t.last_name}</span>
                      <Switch
                        checked={!!t.can_post_announcements}
                        onCheckedChange={(checked) => togglePermitted.mutate({ staffId: t.id, canPost: checked })}
                      />
                    </div>
                  ))}
                  {teachers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No teachers yet.</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" /> New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mid-term break dates" />
                </div>
                <div>
                  <Label>Message</Label>
                  <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} placeholder="Details for students, teachers, and parents..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.announcement_type} onValueChange={(v: any) => setForm({ ...form, announcement_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notice">Notice</SelectItem>
                        <SelectItem value="banner">Banner</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="downtime">Downtime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSave}
                  disabled={createAnnouncement.isPending || updateAnnouncement.isPending || !form.title.trim() || !form.content.trim()}
                >
                  {(createAnnouncement.isPending || updateAnnouncement.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editing ? 'Save Changes' : 'Post Announcement'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No announcements yet.</p>
        ) : (
          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{a.title}</p>
                    <Badge variant="outline" className="text-xs">{a.announcement_type}</Badge>
                    {a.priority === 'high' && <Badge variant="destructive" className="text-xs">High</Badge>}
                    {!a.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isAdmin && (
                    <Switch
                      checked={a.is_active}
                      onCheckedChange={(checked) => updateAnnouncement.mutate({ id: a.id, is_active: checked })}
                      title={a.is_active ? 'Deactivate' : 'Reactivate'}
                    />
                  )}
                  {(isAdmin || a.created_by === user?.id) && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)} title="Edit announcement">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => deleteAnnouncement.mutate(a.id)}
                     title="Delete announcement">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

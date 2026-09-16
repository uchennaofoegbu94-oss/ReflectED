import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingApprovalsCard } from '@/components/shared/PendingApprovalsCard';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Building2, Plus, School, Users, Copy, Mail, Lock, User, ArrowRight, ArrowLeft,
  Trash2, ToggleLeft, ToggleRight, UserPlus, ShieldCheck, GraduationCap, Briefcase,
  Send, MessageSquare, Globe, Megaphone, Settings, BarChart3, Shield, Ticket,
  Eye, EyeOff, KeyRound, Ban, Unlock, Search, FileText, Bell, ChevronRight,
  Activity, TrendingUp, Layers, Puzzle, CheckCircle2, XCircle, Clock, AlertTriangle,
  Edit, Download, RefreshCw, AlertOctagon,
} from 'lucide-react';
import { invokeManageSchool, invokeMessage } from './shared';

export default function SuperAdminAnnouncements() {
  const navigate = useNavigate();
  const onBack = () => navigate("/super-admin");
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', announcement_type: 'notice', priority: 'normal' });

  const { data, isLoading } = useQuery({
    queryKey: ['platform-announcements'],
    queryFn: () => invokeManageSchool({ action: 'get_announcements' }),
  });

  const create = useMutation({
    mutationFn: () => invokeManageSchool({ action: 'create_announcement', ...form }),
    onSuccess: () => {
      toast.success('Announcement published');
      setCreateOpen(false); setForm({ title: '', content: '', announcement_type: 'notice', priority: 'normal' });
      queryClient.invalidateQueries({ queryKey: ['platform-announcements'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      invokeManageSchool({ action: 'toggle_announcement', announcement_id: id, is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-announcements'] }),
  });

  const announcements = data?.announcements || [];
  const typeIcons: Record<string, any> = { banner: AlertTriangle, notice: Bell, update: Activity, downtime: XCircle };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title="Back"><ArrowLeft size={20} /></Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Platform Announcements</h1>
            <p className="text-sm text-muted-foreground">Downtime notices, product updates, banners</p>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus size={16} />New Announcement</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.announcement_type} onValueChange={v => setForm(f => ({ ...f, announcement_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['notice', 'banner', 'update', 'downtime'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['low', 'normal', 'high'].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Content *</Label><Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4} required /></div>
              <Button type="submit" className="w-full" disabled={create.isPending}>{create.isPending ? 'Publishing...' : 'Publish Announcement'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? <div className="space-y-3">{[1, 2].map(i => <Card key={i}><CardContent className="h-20 animate-pulse" /></Card>)}</div> :
          announcements.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Bell size={40} className="mx-auto mb-3 opacity-30" />
              <p>No announcements yet</p>
            </CardContent></Card>
          ) : (
            announcements.map((a: any) => {
              const TypeIcon = typeIcons[a.announcement_type] || Bell;
              return (
                <Card key={a.id} className={!a.is_active ? 'opacity-60' : ''}>
                  <CardContent className="pt-4 pb-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <TypeIcon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-sm">{a.title}</h3>
                          <Badge variant="outline" className="text-xs capitalize">{a.announcement_type}</Badge>
                          {a.priority === 'high' && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(a.created_at), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                    <Switch checked={a.is_active} onCheckedChange={checked => toggle.mutate({ id: a.id, is_active: checked })} />
                  </CardContent>
                </Card>
              );
            })
          )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SUPER ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════
type ViewType = 'dashboard' | 'school-detail' | 'users' | 'analytics' | 'messaging' | 'tickets' | 'audit' | 'announcements' | 'approvals';


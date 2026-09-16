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

export default function SuperAdminMessagingPage() {
  const navigate = useNavigate();
  const onBack = () => navigate("/super-admin");
  const queryClient = useQueryClient();
  const [composeOpen, setComposeOpen] = useState(false);
  const [messageType, setMessageType] = useState<'specific' | 'all_admins' | 'all_users'>('specific');
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [form, setForm] = useState({ subject: '', content: '', priority: 'normal' });

  const { data: adminsData } = useQuery({
    queryKey: ['super-admin-recipients'],
    queryFn: () => invokeMessage({ action: 'get_admin_recipients' }).then(d => d?.admins || []),
  });

  const { data: sentData, isLoading: sentLoading } = useQuery({
    queryKey: ['super-admin-sent-messages'],
    queryFn: () => invokeMessage({ action: 'get_sent_messages' }).then(d => d?.messages || []),
  });

  const sendMessage = useMutation({
    mutationFn: () => invokeMessage({
      action: 'send_message', subject: form.subject, content: form.content,
      priority: form.priority, message_type: messageType,
      recipient_user_ids: messageType === 'specific' ? selectedAdmins : undefined,
    }),
    onSuccess: (data) => {
      toast.success(`Message sent to ${data.recipients_count} recipient(s)`);
      setComposeOpen(false); setForm({ subject: '', content: '', priority: 'normal' }); setSelectedAdmins([]);
      queryClient.invalidateQueries({ queryKey: ['super-admin-sent-messages'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title="Back"><ArrowLeft size={20} /></Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Platform Messaging</h1>
            <p className="text-sm text-muted-foreground">Send messages to school admins or all users</p>
          </div>
        </div>
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Send size={16} />Compose</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Send To</Label>
                <Select value={messageType} onValueChange={(v: any) => setMessageType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="specific">Specific Admin(s)</SelectItem>
                    <SelectItem value="all_admins">All School Admins</SelectItem>
                    <SelectItem value="all_users">All Platform Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {messageType === 'specific' && (
                <div className="space-y-2">
                  <Label>Select Recipients</Label>
                  <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                    {(adminsData || []).length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No admins found</p> : (
                      (adminsData || []).map((admin: any) => (
                        <label key={admin.user_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                          <Checkbox checked={selectedAdmins.includes(admin.user_id)} onCheckedChange={() => setSelectedAdmins(prev => prev.includes(admin.user_id) ? prev.filter(id => id !== admin.user_id) : [...prev, admin.user_id])} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{admin.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{admin.school_name} · {admin.email}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {messageType === 'all_admins' && <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground flex items-center gap-2"><Megaphone size={16} />Broadcast to all school admins ({(adminsData || []).length})</div>}
              {messageType === 'all_users' && <div className="p-3 rounded-lg bg-destructive/10 text-sm text-destructive flex items-center gap-2"><Globe size={16} />Broadcast to every user on the platform</div>}

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High / Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Subject *</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Message *</Label><Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} /></div>
              <Button className="w-full gap-2" onClick={() => sendMessage.mutate()} disabled={sendMessage.isPending || !form.subject.trim() || !form.content.trim() || (messageType === 'specific' && selectedAdmins.length === 0)}>
                {sendMessage.isPending ? 'Sending...' : 'Send Message'}<Send size={16} />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare size={18} />Sent Messages</CardTitle></CardHeader>
        <CardContent>
          {sentLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse h-16 bg-muted rounded-lg" />)}</div> :
            (sentData || []).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No messages sent yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(sentData || []).map((msg: any) => (
                  <div key={msg.id} className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{msg.subject}</p>
                        {msg.is_broadcast && <Badge variant="secondary" className="text-xs shrink-0">{msg.target_roles?.includes('admin') ? 'All Admins' : 'Broadcast'}</Badge>}
                        <Badge variant="outline" className={`text-xs shrink-0 ${msg.priority === 'high' ? 'border-destructive text-destructive' : ''}`}>{msg.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{msg.content}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-muted-foreground">{new Date(msg.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-muted-foreground">{msg.recipient_count} recipients</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Announcements View
// ═══════════════════════════════════════════════════════

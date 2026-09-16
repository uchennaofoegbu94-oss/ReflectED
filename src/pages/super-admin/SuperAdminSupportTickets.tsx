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

export default function SuperAdminSupport() {
  const navigate = useNavigate();
  const onBack = () => navigate("/super-admin");
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [resolution, setResolution] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => invokeManageSchool({ action: 'get_all_tickets' }),
  });

  const updateTicket = useMutation({
    mutationFn: (updates: any) => invokeManageSchool({ action: 'update_ticket', ...updates }),
    onSuccess: () => {
      toast.success('Ticket updated');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setSelectedTicket(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const tickets = data?.tickets || [];
  const statusColors: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    closed: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back"><ArrowLeft size={20} /></Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">View and manage support requests from schools</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['open', 'in_progress', 'resolved', 'closed'].map(status => (
          <Card key={status}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xl font-bold">{tickets.filter((t: any) => t.status === status).length}</p>
              <p className="text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-base">Tickets</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse h-16 bg-muted rounded" />)}</div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Ticket size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No tickets yet</p>
                </div>
              ) : (
                tickets.map((t: any) => (
                  <div key={t.id} className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${selectedTicket?.id === t.id ? 'bg-muted' : ''}`}
                    onClick={() => { setSelectedTicket(t); setResolution(t.resolution_notes || ''); }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{t.subject}</p>
                      <Badge className={`text-xs shrink-0 ${statusColors[t.status]}`}>{t.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{t.school_name} · {t.submitter_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(t.created_at), 'MMM d, h:mm a')}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {selectedTicket ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold">{selectedTicket.subject}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge className={statusColors[selectedTicket.status]}>{selectedTicket.status}</Badge>
                    <Badge variant="outline">{selectedTicket.priority}</Badge>
                    <span className="text-xs text-muted-foreground">{selectedTicket.category}</span>
                  </div>
                </div>
                <div className="text-sm"><span className="text-muted-foreground">From:</span> {selectedTicket.submitter_name} ({selectedTicket.submitter_email})</div>
                <div className="text-sm"><span className="text-muted-foreground">School:</span> {selectedTicket.school_name}</div>
                <div className="text-sm"><span className="text-muted-foreground">Submitted:</span> {format(new Date(selectedTicket.created_at), 'MMMM d, yyyy h:mm a')}</div>
                <div className="border-t pt-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex gap-2">
                    <Label className="shrink-0 mt-2">Status:</Label>
                    <Select value={selectedTicket.status} onValueChange={v => updateTicket.mutate({ ticket_id: selectedTicket.id, status: v })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Resolution Notes</Label>
                    <Textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={3} placeholder="Add resolution notes..." />
                    <Button size="sm" onClick={() => updateTicket.mutate({ ticket_id: selectedTicket.id, resolution_notes: resolution })} disabled={updateTicket.isPending}>
                      Save Notes
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Ticket size={48} className="mx-auto mb-3 opacity-20" />
                <p>Select a ticket to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Audit Log View
// ═══════════════════════════════════════════════════════
const AUDIT_ENTITY_TYPES = ['school_setting', 'staff', 'special_role', 'permission_grant'];


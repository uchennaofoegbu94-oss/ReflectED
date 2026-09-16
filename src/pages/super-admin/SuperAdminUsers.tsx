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

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const onBack = () => navigate("/super-admin");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => invokeManageSchool({ action: 'get_all_users' }),
  });

  const resetPassword = useMutation({
    mutationFn: (target: any) => invokeManageSchool({
      action: 'reset_password',
      target_user_id: target.user_id,
      target_email: target.email,
      redirect_to: `${window.location.origin}/reset-password`,
    }),
    onSuccess: (_data, target) => toast.success(`Password reset email sent to ${target.email}`),
    onError: (err: any) => toast.error(err.message),
  });

  const forceLogout = useMutation({
    mutationFn: (target: any) => invokeManageSchool({ action: 'force_logout', target_user_id: target.user_id }),
    onSuccess: (_data, target) => toast.success(`${target.full_name} has been logged out everywhere`),
    onError: (err: any) => toast.error(err.message),
  });

  const toggleLock = useMutation({
    mutationFn: ({ user_id, ban }: { user_id: string; ban: boolean }) =>
      invokeManageSchool({ action: 'toggle_user_lock', target_user_id: user_id, ban }),
    onSuccess: (_, { ban }) => {
      toast.success(ban ? 'User locked' : 'User unlocked');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
    onError: (err: any) => toast.error(err.message),
  });


  const users = (data?.users || []).filter((u: any) =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.school_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCsv = () => {
    const header = ['Name', 'Email', 'Role', 'School'];
    const rows = users.map((u: any) => [u.full_name || '', u.email || '', u.role || '', u.school_name || '']);
    const csv = [header, ...rows].map(r => r.map((v: string) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 justify-between flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title="Back"><ArrowLeft size={20} /></Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage all users across schools — reset passwords, lock/unlock accounts</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={users.length === 0}>
          <Download size={16} />
          Export CSV
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="animate-pulse h-12 bg-muted rounded" />)}</div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">School</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any, i: number) => (
                    <tr key={`${u.user_id}-${i}`} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{u.full_name}</td>
                      <td className="py-2.5 text-muted-foreground">{u.email}</td>
                      <td className="py-2.5"><Badge variant="outline" className="capitalize text-xs">{u.role}</Badge></td>
                      <td className="py-2.5 text-muted-foreground text-xs">{u.school_name || '—'}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Send password reset email"
                            onClick={() => resetPassword.mutate(u)} disabled={resetPassword.isPending}>
                            <KeyRound size={14} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Force logout (revoke all sessions)">
                                <RefreshCw size={14} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Force logout {u.full_name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This immediately ends every active session for this account — they'll need to sign in again wherever they're logged in.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => forceLogout.mutate(u)}>Force Logout</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Lock account"
                            onClick={() => toggleLock.mutate({ user_id: u.user_id, ban: true })}>
                            <Ban size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Unlock account"
                            onClick={() => toggleLock.mutate({ user_id: u.user_id, ban: false })}>
                            <Unlock size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Platform Analytics View
// ═══════════════════════════════════════════════════════

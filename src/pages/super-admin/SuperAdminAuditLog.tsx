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

// Was defined at module scope in the old monolithic SuperAdmin.tsx, right
// next to where AuditLogView used to live — lost in the page-by-page
// extraction since it landed just outside this view's line range. This is
// what caused the blank white page: an unhandled ReferenceError renders
// nothing rather than throwing a visible error state.
// Reflects what the audit-logging triggers/edge functions actually write
// as entity_type (see the audit_log_triggers migration and
// delete-user-account/manage-school's explicit inserts) — the original
// list only covered 4 of these and used singular forms that didn't match
// the trigger's TG_TABLE_NAME (plural table names), so filtering by e.g.
// "special_role" silently matched nothing even though those rows existed.
const AUDIT_ENTITY_TYPES = [
  'user_roles', 'students', 'staff', 'payments', 'schools', 'school_settings',
  'permission_grants', 'special_roles', 'school_subscriptions', 'auth_user',
];

export default function SuperAdminAuditLog() {
  const navigate = useNavigate();
  const onBack = () => navigate("/super-admin");
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', entityType, dateFrom, dateTo],
    queryFn: () => invokeManageSchool({
      action: 'get_audit_logs',
      limit: 200,
      entity_type: entityType === 'all' ? undefined : entityType,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
  });

  // Search stays client-side — it spans free-text across user/action/entity/school,
  // which the filters above don't cover server-side.
  const logs = (data?.logs || []).filter((l: any) =>
    !search || l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.school_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} title="Back"><ArrowLeft size={20} /></Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Security and activity logs across all schools</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {AUDIT_ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3, 4, 5].map(i => <div key={i} className="animate-pulse h-10 bg-muted rounded" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No audit logs match these filters</p>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">Entity</th>
                    <th className="pb-2 font-medium">School</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(l.created_at), 'MMM d, h:mm a')}</td>
                      <td className="py-2">{l.user_name || '—'}</td>
                      <td className="py-2"><Badge variant="outline" className="text-xs">{l.action}</Badge></td>
                      <td className="py-2 text-muted-foreground text-xs">{l.entity_type}</td>
                      <td className="py-2 text-muted-foreground text-xs">{l.school_name || '—'}</td>
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
// Messaging View (re-used from before)
// ═══════════════════════════════════════════════════════

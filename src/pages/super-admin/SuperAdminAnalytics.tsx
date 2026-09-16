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

export default function SuperAdminAnalytics() {
  const navigate = useNavigate();
  const onBack = () => navigate("/super-admin");
  const { data, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => invokeManageSchool({ action: 'get_platform_stats' }),
  });

  const totals = data?.totals || {};
  const breakdown = data?.school_breakdown || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Platform Analytics</h1>
        <p className="text-sm text-muted-foreground">Cross-school data oversight and performance metrics</p>
        <p className="text-xs text-muted-foreground mt-1">
          "Tuition Collected" below is each school's own fee collections from their students — not ReflectED's
          platform revenue. Subscription/billing tracking lives on the{' '}
          <button className="underline hover:text-foreground" onClick={() => navigate('/super-admin/billing')}>Billing page</button>.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="h-20 animate-pulse" /></Card>)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Building2, label: 'Total Schools', value: totals.schools, color: 'text-primary' },
              { icon: CheckCircle2, label: 'Active Schools', value: totals.active_schools, color: 'text-green-600' },
              { icon: GraduationCap, label: 'Total Students', value: totals.students, color: 'text-blue-600' },
              { icon: Briefcase, label: 'Total Staff', value: totals.staff, color: 'text-purple-600' },
              { icon: Layers, label: 'Total Classes', value: totals.classes, color: 'text-orange-600' },
              { icon: TrendingUp, label: 'Tuition Collected (All Schools)', value: `₦${(totals.total_revenue || 0).toLocaleString()}`, color: 'text-green-600' },
              { icon: Activity, label: 'Attendance Records', value: totals.attendance_records, color: 'text-cyan-600' },
              { icon: Ticket, label: 'Open Tickets', value: totals.open_tickets, color: 'text-red-600' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                    <div><p className="text-xl font-bold">{s.value ?? 0}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">School Performance Comparison</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">School</th>
                      <th className="pb-2 font-medium text-center">Status</th>
                      <th className="pb-2 font-medium text-center">Students</th>
                      <th className="pb-2 font-medium text-center">Staff</th>
                      <th className="pb-2 font-medium text-center">Classes</th>
                      <th className="pb-2 font-medium text-right">Tuition Collected</th>
                      <th className="pb-2 font-medium text-center">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((s: any) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2.5 font-medium">{s.name}</td>
                        <td className="py-2.5 text-center">
                          <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-xs">{s.is_active ? 'Active' : 'Inactive'}</Badge>
                        </td>
                        <td className="py-2.5 text-center">{s.students}</td>
                        <td className="py-2.5 text-center">{s.staff}</td>
                        <td className="py-2.5 text-center">{s.classes}</td>
                        <td className="py-2.5 text-right">₦{(s.revenue || 0).toLocaleString()}</td>
                        <td className="py-2.5 text-center">{s.attendance_records}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Support Tickets View
// ═══════════════════════════════════════════════════════

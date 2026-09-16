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

import { useParams } from 'react-router-dom';

function SchoolDetailViewInner({ schoolId }: { schoolId: string }) {
  const navigate = useNavigate();
  const onBack = () => navigate("/super-admin/schools");
  const queryClient = useQueryClient();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [switchAdminOpen, setSwitchAdminOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [featureFlagsOpen, setFeatureFlagsOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'student' });
  const [selectedNewAdmin, setSelectedNewAdmin] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['school-detail', schoolId],
    queryFn: () => invokeManageSchool({ action: 'get_school_details', school_id: schoolId }),
  });

  const { data: flagsData, refetch: refetchFlags } = useQuery({
    queryKey: ['feature-flags', schoolId],
    queryFn: () => invokeManageSchool({ action: 'get_feature_flags', school_id: schoolId }),
  });

  const toggleStatus = useMutation({
    mutationFn: (is_active: boolean) => invokeManageSchool({ action: 'toggle_school_status', school_id: schoolId, is_active }),
    onSuccess: (_, is_active) => {
      toast.success(`School ${is_active ? 'activated' : 'deactivated'}`);
      queryClient.invalidateQueries({ queryKey: ['school-detail', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
    },
  });

  const deleteSchool = useMutation({
    mutationFn: () => invokeManageSchool({ action: 'delete_school', school_id: schoolId }),
    onSuccess: () => { toast.success('School deleted'); queryClient.invalidateQueries({ queryKey: ['all-schools'] }); onBack(); },
  });

  const createUser = useMutation({
    mutationFn: () => invokeManageSchool({ action: 'create_user', school_id: schoolId, ...newUser }),
    onSuccess: () => {
      toast.success('User created'); setCreateUserOpen(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'student' });
      queryClient.invalidateQueries({ queryKey: ['school-detail', schoolId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const switchAdmin = useMutation({
    mutationFn: () => invokeManageSchool({ action: 'switch_admin', school_id: schoolId, new_admin_user_id: selectedNewAdmin }),
    onSuccess: () => {
      toast.success('Admin switched'); setSwitchAdminOpen(false); setSelectedNewAdmin('');
      queryClient.invalidateQueries({ queryKey: ['school-detail', schoolId] });
    },
  });

  const editSchool = useMutation({
    mutationFn: (updates: any) => invokeManageSchool({ action: 'edit_school_profile', school_id: schoolId, ...updates }),
    onSuccess: () => {
      toast.success('School profile updated'); setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['school-detail', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleFlag = useMutation({
    mutationFn: ({ module_name, is_enabled }: { module_name: string; is_enabled: boolean }) =>
      invokeManageSchool({ action: 'set_feature_flag', school_id: schoolId, module_name, is_enabled }),
    onSuccess: () => refetchFlags(),
  });

  const initFlags = useMutation({
    mutationFn: () => invokeManageSchool({ action: 'init_feature_flags', school_id: schoolId }),
    onSuccess: () => { toast.success('Feature flags initialized'); refetchFlags(); },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2"><ArrowLeft size={16} />Back</Button>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <Card key={i}><CardContent className="h-32" /></Card>)}
        </div>
      </div>
    );
  }
  if (!data) return null;
  const { school, students, staff, classes, admins } = data;
  const flags = flagsData?.flags || [];

  const moduleLabels: Record<string, string> = {
    cbt_quizzes: "CBT / Quizzes", lms_classroom: "LMS Classroom", attendance: "Attendance",
    timetable: "Timetable", events: "Events", fees_payments: "Fees & Payments",
    results: "Results", id_cards: "ID Cards", parent_portal: "Parent Portal",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} title="Back"><ArrowLeft size={20} /></Button>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="font-display text-2xl font-bold text-primary">{school.name?.[0]}</span>
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{school.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-muted-foreground">{school.school_code}</span>
                <Badge variant={school.is_active ? 'default' : 'secondary'}>{school.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
            <Edit size={16} />Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toggleStatus.mutate(!school.is_active)} disabled={toggleStatus.isPending}>
            {school.is_active ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            {school.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2"><Trash2 size={16} />Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{school.name}" permanently?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete the school, all its users, data, and records.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteSchool.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleteSchool.isPending ? 'Deleting...' : 'Delete Permanently'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: GraduationCap, label: 'Students', value: students.length },
          { icon: Briefcase, label: 'Staff', value: staff.length },
          { icon: School, label: 'Classes', value: classes.length },
          { icon: ShieldCheck, label: 'Admins', value: admins.length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-primary" />
                <div><p className="text-xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-2"><UserPlus size={16} />Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add User to {school.name}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createUser.mutate(); }} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['student', 'teacher', 'admin', 'principal', 'accountant'].map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Full Name *</Label><Input value={newUser.full_name} onChange={e => setNewUser(f => ({ ...f, full_name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(f => ({ ...f, email: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Password *</Label><Input type="password" value={newUser.password} onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))} required minLength={6} /></div>
              <Button type="submit" className="w-full" disabled={createUser.isPending}>{createUser.isPending ? 'Creating...' : 'Create User'}</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={switchAdminOpen} onOpenChange={setSwitchAdminOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-2"><ShieldCheck size={16} />Switch Admin</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Switch Admin for {school.name}</DialogTitle>
              <p className="text-sm text-muted-foreground">Current admin(s) will be demoted to teacher role</p>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {admins.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Current Admin(s)</p>
                  {admins.map((a: any) => <p key={a.user_id} className="text-sm">{a.full_name} ({a.email})</p>)}
                </div>
              )}
              <div className="space-y-2">
                <Label>New Admin</Label>
                <Select value={selectedNewAdmin} onValueChange={setSelectedNewAdmin}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s: any) => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name} ({s.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => switchAdmin.mutate()} disabled={!selectedNewAdmin || switchAdmin.isPending}>
                {switchAdmin.isPending ? 'Switching...' : 'Switch Admin'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button size="sm" variant="outline" className="gap-2" onClick={() => setFeatureFlagsOpen(true)}>
          <Puzzle size={16} />Feature Flags
        </Button>
      </div>

      {/* Edit School Dialog */}
      <EditSchoolDialog open={editOpen} onOpenChange={setEditOpen} school={school} onSave={(updates: any) => editSchool.mutate(updates)} isPending={editSchool.isPending} />

      {/* Feature Flags Dialog */}
      <Dialog open={featureFlagsOpen} onOpenChange={setFeatureFlagsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Puzzle size={18} />Feature Flags — {school.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {flags.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">No feature flags configured</p>
                <Button size="sm" onClick={() => initFlags.mutate()} disabled={initFlags.isPending}>
                  {initFlags.isPending ? 'Initializing...' : 'Initialize Default Flags'}
                </Button>
              </div>
            ) : (
              flags.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{moduleLabels[f.module_name] || f.module_name}</p>
                    <p className="text-xs text-muted-foreground">{f.module_name}</p>
                  </div>
                  <Switch
                    checked={f.is_enabled}
                    onCheckedChange={checked => toggleFlag.mutate({ module_name: f.module_name, is_enabled: checked })}
                  />
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Data Tabs */}
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff ({staff.length})</TabsTrigger>
          <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
          <TabsTrigger value="classes">Classes ({classes.length})</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
        <TabsContent value="staff">
          <Card><CardContent className="pt-4">
            {staff.length === 0 ? <p className="text-center text-muted-foreground py-8">No staff yet</p> : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Email</th><th className="pb-2 font-medium">Employee ID</th><th className="pb-2 font-medium">Joined</th></tr></thead>
                  <tbody>
                    {staff.map((s: any) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2">{s.first_name} {s.last_name}</td>
                        <td className="py-2 text-muted-foreground">{s.email}</td>
                        <td className="py-2 font-mono text-xs">{s.employee_id}</td>
                        <td className="py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="students">
          <Card><CardContent className="pt-4">
            {students.length === 0 ? <p className="text-center text-muted-foreground py-8">No students yet</p> : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Admission No.</th><th className="pb-2 font-medium">Gender</th><th className="pb-2 font-medium">Joined</th></tr></thead>
                  <tbody>
                    {students.map((s: any) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2">{s.first_name} {s.last_name}</td>
                        <td className="py-2 font-mono text-xs">{s.admission_number}</td>
                        <td className="py-2 capitalize text-muted-foreground">{s.gender}</td>
                        <td className="py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="classes">
          <Card><CardContent className="pt-4">
            {classes.length === 0 ? <p className="text-center text-muted-foreground py-8">No classes yet</p> : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {classes.map((c: any) => (
                  <div key={c.id} className="p-3 rounded-lg border bg-card">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Arm: {c.arm} · {c.level}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="info">
          <Card><CardContent className="pt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground">Email:</span> {school.email || '—'}</div>
              <div><span className="text-muted-foreground">Phone:</span> {school.phone || '—'}</div>
              <div><span className="text-muted-foreground">Address:</span> {school.address || '—'}</div>
              <div><span className="text-muted-foreground">Created:</span> {new Date(school.created_at).toLocaleDateString()}</div>
            </div>
            {admins.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Admin(s)</p>
                {admins.map((a: any) => (
                  <div key={a.user_id} className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-primary" /><span>{a.full_name}</span>
                    <span className="text-muted-foreground">({a.email})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Edit School Dialog ───
function EditSchoolDialog({ open, onOpenChange, school, onSave, isPending }: any) {
  const [form, setForm] = useState({
    name: school?.name || '', email: school?.email || '',
    phone: school?.phone || '', address: school?.address || '',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit School Profile</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4 mt-2">
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
          <Button type="submit" className="w-full" disabled={isPending}>{isPending ? 'Saving...' : 'Save Changes'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SuperAdminSchoolDetail() {
  const { schoolId } = useParams<{ schoolId: string }>();
  if (!schoolId) return null;
  return <SchoolDetailViewInner schoolId={schoolId} />;
}

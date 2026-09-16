import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Building2, School, Users, Plus, Copy, ArrowRight, Download } from 'lucide-react';

// Extracted from the old monolithic SuperAdmin.tsx's default "dashboard"
// view. The old inline "Quick Nav" grid (links to every other section)
// is dropped here — that was a workaround for having no real navigation
// at all; SuperAdminLayout's sidebar replaces it properly.
export default function SuperAdminSchools() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    school_name: '', school_code: '', school_email: '', school_address: '',
    school_phone: '', admin_email: '', admin_password: '', admin_full_name: '',
  });

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['all-schools'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schools' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.isSuperAdmin,
  });

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.school_name.trim() || !form.school_code.trim() || !form.admin_email || !form.admin_password || !form.admin_full_name) {
      toast.error('All required fields must be filled'); return;
    }
    if (form.admin_password.length < 6) { toast.error('Admin password must be at least 6 characters'); return; }
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-school-with-admin', {
        body: { ...form, created_by: user?.id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      queryClient.invalidateQueries({ queryKey: ['all-schools'] });
      setCreateOpen(false);
      setForm({ school_name: '', school_code: '', school_email: '', school_address: '', school_phone: '', admin_email: '', admin_password: '', admin_full_name: '' });
      toast.success(`School "${form.school_name}" created!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create school');
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportCsv = () => {
    const header = ['Name', 'Code', 'Email', 'Phone', 'Address', 'Status', 'Created'];
    const rows = schools.map((s: any) => [
      s.name, s.school_code, s.email || '', s.phone || '', s.address || '',
      s.is_active ? 'Active' : 'Inactive', new Date(s.created_at).toLocaleDateString(),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schools-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Schools</h1>
          <p className="text-muted-foreground mt-1">Manage every school (tenant) on the ReflectED platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={schools.length === 0}>
            <Download size={16} />
            Export CSV
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus size={18} />Create School</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New School</DialogTitle>
                <p className="text-sm text-muted-foreground">Set up a school and its first admin account</p>
              </DialogHeader>
              <form onSubmit={handleCreateSchool} className="space-y-5 mt-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">School Details</h3>
                  <div className="space-y-2"><Label>School Name *</Label><Input placeholder="e.g. Springfield Academy" value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} required /></div>
                  <div className="space-y-2">
                    <Label>School Code *</Label>
                    <Input placeholder="e.g. SPRINGFIELD" value={form.school_code} onChange={e => setForm(f => ({ ...f, school_code: e.target.value.toUpperCase().replace(/\s/g, '') }))} className="uppercase" required />
                    <p className="text-xs text-muted-foreground">Unique code for staff/students to join</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="info@school.com" value={form.school_email} onChange={e => setForm(f => ({ ...f, school_email: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Phone</Label><Input placeholder="08012345678" value={form.school_phone} onChange={e => setForm(f => ({ ...f, school_phone: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Address</Label><Input placeholder="School address" value={form.school_address} onChange={e => setForm(f => ({ ...f, school_address: e.target.value }))} /></div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">School Admin Account</h3>
                  <div className="space-y-2"><Label>Admin Full Name *</Label><Input placeholder="Admin's full name" value={form.admin_full_name} onChange={e => setForm(f => ({ ...f, admin_full_name: e.target.value }))} required /></div>
                  <div className="space-y-2"><Label>Admin Email *</Label><Input type="email" placeholder="admin@school.com" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required /></div>
                  <div className="space-y-2"><Label>Admin Password *</Label><Input type="password" placeholder="Min 6 characters" value={form.admin_password} onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required minLength={6} /></div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={isCreating}>{isCreating ? 'Creating...' : 'Create School & Admin'}<ArrowRight size={18} /></Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></div>
              <div><p className="text-2xl font-bold text-foreground">{schools.length}</p><p className="text-sm text-muted-foreground">Total Schools</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/10"><School className="h-6 w-6 text-green-600" /></div>
              <div><p className="text-2xl font-bold text-foreground">{schools.filter((s: any) => s.is_active).length}</p><p className="text-sm text-muted-foreground">Active Schools</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-500/10"><Users className="h-6 w-6 text-orange-600" /></div>
              <div><p className="text-2xl font-bold text-foreground">{schools.filter((s: any) => !s.is_active).length}</p><p className="text-sm text-muted-foreground">Inactive Schools</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schools Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="pt-6 h-40" /></Card>)}</div>
      ) : schools.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Schools Yet</h3>
            <p className="text-muted-foreground text-center mb-4">Create your first school to get started</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus size={18} />Create School</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((school: any) => (
            <Card key={school.id} className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/super-admin/schools/${school.id}`)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="font-display text-xl font-bold text-primary">{school.name?.[0] || 'S'}</span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{school.name}</CardTitle>
                      <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(school.school_code); toast.success('Code copied!'); }}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                        <span className="font-mono">{school.school_code}</span><Copy size={12} />
                      </button>
                    </div>
                  </div>
                  <Badge variant={school.is_active ? 'default' : 'secondary'}>{school.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {school.email && <p>📧 {school.email}</p>}
                  {school.address && <p>📍 {school.address}</p>}
                  <p className="text-xs">Created {new Date(school.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

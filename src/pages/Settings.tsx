import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon, Calendar, GraduationCap, BookOpen,
  Plus, Edit2, Trash2, Check, X, School, Shield, Download, FileText, ClipboardList, Clock, Printer, QrCode,
  Image as ImageIcon, Upload, Loader2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useGradingScales, useUpdateGradingScale, useAddGradingScale, useDeleteGradingScale, type GradingScale } from '@/hooks/useGradingScales';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useSchoolSetting, useUpdateSchoolSetting } from '@/hooks/useSchoolSettings';
import {
  RESTRICT_REPORT_CARDS_STUDENTS_KEY, RESTRICT_REPORT_CARDS_TEACHERS_KEY, REPORT_CARD_EXCEPTION_ROLES_KEY,
  RESTRICT_TRANSCRIPTS_TEACHERS_KEY, TRANSCRIPT_EXCEPTION_ROLES_KEY, BROADSHEET_DOWNLOAD_EXCEPTION_ROLES_KEY,
} from '@/hooks/useAccessRestrictions';
import { useHasPermission } from '@/hooks/usePermissions';
import { STAFF_ROLES, ROLE_LABELS, type SpecialRoleType } from '@/hooks/useSpecialRoles';
import { useSchool } from '@/contexts/SchoolContext';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

// ─── Academic Sessions ───
function useAcademicSessions() {
  return useQuery({
    queryKey: ['academic-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_sessions')
        .select('*, terms(*)')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function AddSessionDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !startDate || !endDate) return toast.error('All fields required');
    setLoading(true);
    const { error } = await supabase.from('academic_sessions').insert({ name, start_date: startDate, end_date: endDate });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Session created');
    setOpen(false);
    setName(''); setStartDate(''); setEndDate('');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus size={16} /> Add Session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Academic Session</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Session Name</Label>
            <Input placeholder="e.g. 2025/2026" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create Session'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddTermDialog({ sessionId, onSuccess }: { sessionId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [termNumber, setTermNumber] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !startDate || !endDate) return toast.error('All fields required');
    setLoading(true);
    const { error } = await supabase.from('terms').insert({
      session_id: sessionId,
      name,
      term_number: parseInt(termNumber),
      start_date: startDate,
      end_date: endDate,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Term created');
    setOpen(false);
    setName(''); setStartDate(''); setEndDate('');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Plus size={14} /> Add Term</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Term</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Term Name</Label>
              <Input placeholder="e.g. First Term" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Term Number</Label>
              <Select value={termNumber} onValueChange={setTermNumber}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1st Term</SelectItem>
                  <SelectItem value="2">2nd Term</SelectItem>
                  <SelectItem value="3">3rd Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create Term'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Grading System ───
function EditGradeDialog({ grade, onSuccess }: { grade: GradingScale; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [gradeVal, setGradeVal] = useState(grade.grade);
  const [minScore, setMinScore] = useState(grade.min_score.toString());
  const [maxScore, setMaxScore] = useState(grade.max_score.toString());
  const [remark, setRemark] = useState(grade.remark);
  const updateGrade = useUpdateGradingScale();

  const handleSubmit = async () => {
    if (!gradeVal || !minScore || !maxScore || !remark) return toast.error('All fields required');
    const minNum = parseFloat(minScore);
    const maxNum = parseFloat(maxScore);
    if (minNum < 0 || maxNum > 100 || minNum > maxNum) return toast.error('Invalid score range');
    
    updateGrade.mutate(
      { ...grade, grade: gradeVal, min_score: minNum, max_score: maxNum, remark },
      { onSuccess: () => { setOpen(false); onSuccess(); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1"><Edit2 size={14} /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Grade Scale</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Grade</Label>
              <Input value={gradeVal} onChange={e => setGradeVal(e.target.value)} placeholder="A" maxLength={1} />
            </div>
            <div className="space-y-2">
              <Label>Remark</Label>
              <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder="Excellent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Score</Label>
              <Input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} min={0} max={100} />
            </div>
            <div className="space-y-2">
              <Label>Max Score</Label>
              <Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} min={0} max={100} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={updateGrade.isPending} className="w-full">
            {updateGrade.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddGradeDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [gradeVal, setGradeVal] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [remark, setRemark] = useState('');
  const addGrade = useAddGradingScale();

  const handleSubmit = () => {
    if (!gradeVal || !minScore || !maxScore || !remark) return toast.error('All fields required');
    const minNum = parseFloat(minScore);
    const maxNum = parseFloat(maxScore);
    if (minNum < 0 || maxNum > 100 || minNum > maxNum) return toast.error('Invalid score range');

    addGrade.mutate(
      { grade: gradeVal, min_score: minNum, max_score: maxNum, remark },
      {
        onSuccess: () => {
          setOpen(false);
          setGradeVal(''); setMinScore(''); setMaxScore(''); setRemark('');
          onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus size={14} /> Add Grade</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Grade Scale</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Grade</Label>
              <Input value={gradeVal} onChange={e => setGradeVal(e.target.value)} placeholder="A" />
            </div>
            <div className="space-y-2">
              <Label>Remark</Label>
              <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder="Excellent" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Score</Label>
              <Input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} min={0} max={100} />
            </div>
            <div className="space-y-2">
              <Label>Max Score</Label>
              <Input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} min={0} max={100} />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={addGrade.isPending} className="w-full">
            {addGrade.isPending ? 'Adding...' : 'Add Grade'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GradingSystemCard() {
  const { data: grades, isLoading, refetch } = useGradingScales();
  const deleteGrade = useDeleteGradingScale();

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Grading System</CardTitle>
          <CardDescription>Configure grade boundaries used in report cards</CardDescription>
        </div>
        <AddGradeDialog onSuccess={() => refetch()} />
      </CardHeader>
      <CardContent>
        {grades && grades.length > 0 ? (
          <div className="space-y-3">
            {grades.map((g) => (
              <div key={g.id} className="flex items-center gap-4 rounded-lg border border-border p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  {g.grade}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{g.min_score} - {g.max_score}%</p>
                  <p className="text-xs text-muted-foreground">{g.remark}</p>
                </div>
                <EditGradeDialog grade={g} onSuccess={() => refetch()} />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (confirm(`Delete ${g.grade} grade?`)) deleteGrade.mutate(g.id);
                  }}
                 title="Delete">
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">No grading scales configured. Add one to get started.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Export Data ───
function ExportDataCard() {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState('students');

  const handleExport = async () => {
    setExporting(true);
    try {
      let data: any[] = [];
      let filename = '';

      if (exportType === 'students') {
        const { data: students } = await supabase
          .from('students')
          .select('first_name, last_name, middle_name, admission_number, gender, enrollment_status, date_of_birth, class_id')
          .eq('enrollment_status', 'active')
          .order('last_name');
        data = students || [];
        filename = 'students-export';
      } else if (exportType === 'staff') {
        const { data: staff } = await supabase
          .from('staff')
          .select('first_name, last_name, middle_name, employee_id, email, phone, gender, qualification, employment_status')
          .order('last_name');
        data = staff || [];
        filename = 'staff-export';
      } else if (exportType === 'payments') {
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, method, payment_date, status, receipt_number, notes, students(first_name, last_name, admission_number), fee_structures(description)')
          .order('payment_date', { ascending: false });
        data = (payments || []).map((p: any) => ({
          student: `${p.students?.first_name} ${p.students?.last_name}`,
          admission_number: p.students?.admission_number,
          fee: p.fee_structures?.description,
          amount: p.amount,
          method: p.method,
          date: p.payment_date,
          status: p.status,
          receipt: p.receipt_number,
        }));
        filename = 'payments-export';
      } else if (exportType === 'attendance') {
        const { data: records } = await supabase
          .from('attendance_records')
          .select('date, status, notes, students(first_name, last_name, admission_number)')
          .order('date', { ascending: false })
          .limit(1000);
        data = (records || []).map((r: any) => ({
          student: `${r.students?.first_name} ${r.students?.last_name}`,
          admission_number: r.students?.admission_number,
          date: r.date,
          status: r.status,
          notes: r.notes,
        }));
        filename = 'attendance-export';
      }

      if (data.length === 0) {
        toast.info('No data to export');
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => {
          const val = (row as any)[h];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? '';
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error: any) {
      toast.error('Export failed: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Download size={18} /> Export Data</CardTitle>
        <CardDescription>Download school records as CSV files</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="students">Students</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="payments">Payments</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Audit Log ───
// Same fix as SuperAdminAuditLog.tsx: reflects the actual entity_type
// values the audit-logging triggers write (plural table names), not the
// old singular guesses that silently matched nothing.
const AUDIT_ENTITY_TYPES = [
  'user_roles', 'students', 'staff', 'payments', 'schools', 'school_settings',
  'permission_grants', 'special_roles', 'school_subscriptions', 'auth_user',
];

function AuditLogCard() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: logs = [], isLoading } = useAuditLog({
    limit: 200,
    search: search.trim() || undefined,
    entityType: entityType === 'all' ? undefined : entityType,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ClipboardList size={18} /> Audit Log</CardTitle>
        <CardDescription>View recent system activity and changes for your school</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Search</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Action, user, entity…" className="w-48" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {AUDIT_ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : logs.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No audit log entries match these filters</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm">{log.user_name || 'System'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.entity_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-48 truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Proctor Mode ───
function ProctorModeCard() {
  const { user } = useAuth();
  const { data: proctorMode, isLoading } = useSchoolSetting('proctor_mode');
  const updateSetting = useUpdateSchoolSetting();

  const handleToggle = (checked: boolean) => {
    if (!user) return;
    updateSetting.mutate({ key: 'proctor_mode', value: checked, updatedBy: user.id });
  };

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield size={18} className="text-warning" />
          Proctor Mode
        </CardTitle>
        <CardDescription>
          When enabled, students cannot access class materials, notes, or previous assignments. They can only access active examinations and quizzes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Proctor Mode</p>
            <p className="text-sm text-muted-foreground">Restrict student access during examination periods</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-11" />
          ) : (
            <Switch
              checked={!!proctorMode}
              onCheckedChange={handleToggle}
              disabled={updateSetting.isPending}
            />
          )}
        </div>
        {proctorMode && (
          <Badge className="mt-3 bg-warning/10 text-warning border-warning/30">
            ⚠ Proctor Mode is ACTIVE — Students have restricted access
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Report Card / Transcript Access Restrictions ───
function RoleExceptionPicker({
  settingKey,
  label,
}: {
  settingKey: string;
  label: string;
}) {
  const { user } = useAuth();
  const { data: selectedRolesRaw, isLoading } = useSchoolSetting(settingKey);
  const updateSetting = useUpdateSchoolSetting();
  const selectedRoles: SpecialRoleType[] = Array.isArray(selectedRolesRaw) ? selectedRolesRaw : [];

  const toggleRole = (role: SpecialRoleType, checked: boolean) => {
    if (!user) return;
    const next = checked
      ? [...selectedRoles, role]
      : selectedRoles.filter((r) => r !== role);
    updateSetting.mutate({ key: settingKey, value: next, updatedBy: user.id });
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-medium mb-1">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
        {STAFF_ROLES.map((role) => (
          <div key={role} className="flex items-center gap-2">
            <Checkbox
              id={`${settingKey}-${role}`}
              checked={selectedRoles.includes(role)}
              onCheckedChange={(checked) => toggleRole(role, !!checked)}
              disabled={updateSetting.isPending}
            />
            <label htmlFor={`${settingKey}-${role}`} className="text-sm text-muted-foreground cursor-pointer">
              {ROLE_LABELS[role]}
            </label>
          </div>
        ))}
      </div>
      {selectedRoles.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selectedRoles.map((role) => (
            <Badge key={role} variant="secondary" className="text-xs">{ROLE_LABELS[role]}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function AccessRestrictionsCard() {
  const { user } = useAuth();
  const updateSetting = useUpdateSchoolSetting();

  const { data: restrictRCStudents, isLoading: l1 } = useSchoolSetting(RESTRICT_REPORT_CARDS_STUDENTS_KEY);
  const { data: restrictRCTeachers, isLoading: l2 } = useSchoolSetting(RESTRICT_REPORT_CARDS_TEACHERS_KEY);
  const { data: restrictTranscriptTeachers, isLoading: l3 } = useSchoolSetting(RESTRICT_TRANSCRIPTS_TEACHERS_KEY);

  const handleToggle = (key: string, checked: boolean) => {
    if (!user) return;
    updateSetting.mutate({ key, value: checked, updatedBy: user.id });
  };

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield size={18} className="text-warning" />
          Report Card & Transcript Access
        </CardTitle>
        <CardDescription>
          Lock down report card/transcript VIEWING school-wide — useful while results are still being
          finalized. Independently of these toggles, PDF downloads of report cards, transcripts, and
          broadsheets are always limited to admin/principal plus whichever roles are exempted below
          (e.g. Vice-Principal, Dean of Studies) — a plain teacher can never download these, even when
          viewing itself is unrestricted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Restrict Students from Report Cards</p>
              <p className="text-sm text-muted-foreground">Students can't view their own report card while this is on</p>
            </div>
            {l1 ? <Skeleton className="h-6 w-11" /> : (
              <Switch
                checked={!!restrictRCStudents}
                onCheckedChange={(c) => handleToggle(RESTRICT_REPORT_CARDS_STUDENTS_KEY, c)}
                disabled={updateSetting.isPending}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Restrict Teachers from Report Cards</p>
              <p className="text-sm text-muted-foreground">Teachers can't view any student's report card while this is on</p>
            </div>
            {l2 ? <Skeleton className="h-6 w-11" /> : (
              <Switch
                checked={!!restrictRCTeachers}
                onCheckedChange={(c) => handleToggle(RESTRICT_REPORT_CARDS_TEACHERS_KEY, c)}
                disabled={updateSetting.isPending}
              />
            )}
          </div>
          <RoleExceptionPicker
            settingKey={REPORT_CARD_EXCEPTION_ROLES_KEY}
            label="Exempted roles (report card view-restriction + always required for teacher downloads)"
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="font-medium">Restrict Teachers from Transcripts</p>
              <p className="text-sm text-muted-foreground">Teachers can't view transcripts while this is on</p>
            </div>
            {l3 ? <Skeleton className="h-6 w-11" /> : (
              <Switch
                checked={!!restrictTranscriptTeachers}
                onCheckedChange={(c) => handleToggle(RESTRICT_TRANSCRIPTS_TEACHERS_KEY, c)}
                disabled={updateSetting.isPending}
              />
            )}
          </div>
          <RoleExceptionPicker
            settingKey={TRANSCRIPT_EXCEPTION_ROLES_KEY}
            label="Exempted roles (transcript view-restriction + always required for teacher downloads)"
          />
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="pt-3">
            <p className="font-medium">Broadsheet Downloads</p>
            <p className="text-sm text-muted-foreground">
              All teachers can always view the Broadsheet tab — this only controls who besides
              admin/principal can download the broadsheet PDF.
            </p>
          </div>
          <RoleExceptionPicker
            settingKey={BROADSHEET_DOWNLOAD_EXCEPTION_ROLES_KEY}
            label="Exempted roles (can download broadsheets)"
          />
        </div>

        {(restrictRCStudents || restrictRCTeachers || restrictTranscriptTeachers) && (
          <Badge className="bg-warning/10 text-warning border-warning/30">
            ⚠ One or more view restrictions are ACTIVE
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Attendance Parameters ───
function AttendanceParametersCard() {
  const [lateMinutes, setLateMinutes] = useState('30');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('attendance_parameters' as any)
      .update({ late_after_minutes: parseInt(lateMinutes) || 30, updated_at: new Date().toISOString() })
      .not('id', 'is', null);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Attendance parameters updated');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock size={18} />
          Attendance Parameters
        </CardTitle>
        <CardDescription>Configure lateness thresholds and excuse reasons</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="space-y-2 flex-1">
            <Label>Late After (minutes)</Label>
            <Input type="number" value={lateMinutes} onChange={e => setLateMinutes(e.target.value)} min={1} max={120} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-6">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Students arriving after this many minutes from the start of school will be marked as late.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Staff Clock-In/Out QR ───
function StaffClockInQRCard() {
  const { school } = useSchool();
  const schoolName = school?.name || 'School';
  const qrValue = school?.id ? `CLOCK:STAFF:${school.id}` : 'CLOCK:STAFF';
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Staff Clock-In QR</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; }
        .qr-container { text-align: center; padding: 40px; border: 2px solid #ccc; border-radius: 16px; }
        h2 { margin-bottom: 16px; color: #1FA4A9; }
        p { color: #666; font-size: 14px; margin-top: 12px; }
      </style></head><body>
      ${content.innerHTML}
      <script>window.print(); window.close();<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode size={18} />
          Staff Clock-In/Out QR Code
        </CardTitle>
        <CardDescription>Print and display this QR code for staff to scan when clocking in or out</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="bg-white p-6 rounded-xl border border-border">
          <QRCodeSVG value={qrValue} size={200} level="H" />
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Staff members scan this code to record their clock-in and clock-out times
        </p>
        <Button onClick={handlePrint} className="gap-2">
          <Printer size={16} /> Print QR Code
        </Button>
        {/* Hidden print content */}
        <div ref={printRef} style={{ display: 'none' }}>
          <div className="qr-container">
            <h2>{schoolName}</h2>
            <QRCodeSVG value={qrValue} size={300} level="H" />
            <p>Scan to Clock In / Clock Out</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── School Info ───
function SchoolInfoCard() {
  const { school } = useSchool();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '', tagline: '' });
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  if (school && !initialized) {
    setForm({
      name: school.name || '',
      address: school.address || '',
      phone: school.phone || '',
      email: school.email || '',
      tagline: school.tagline || '',
    });
    setInitialized(true);
  }

  const canEdit = useHasPermission('manage_school_settings');

  const handleSave = async () => {
    if (!school?.id) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('schools' as any)
      .update({ name: form.name, address: form.address, phone: form.phone, email: form.email, tagline: form.tagline || null })
      .eq('id', school.id)
      .select('id');
    setSaving(false);
    if (error) return toast.error(error.message);
    // A 0-row update from a blocked RLS policy doesn't throw an error on its
    // own — this is what let the old missing-UPDATE-policy bug silently
    // report success while changing nothing. Requesting the row back via
    // .select() and checking it's actually there catches that case for good.
    if (!data || data.length === 0) return toast.error("Update didn't go through — you may not have permission to edit school info.");
    toast.success('School info updated');
    queryClient.invalidateQueries({ queryKey: ['school'] });
  };

  const handleImageUpload = async (
    field: 'logo_url' | 'principal_signature_url' | 'school_stamp_url',
    slug: 'logo' | 'signature' | 'stamp',
    file: File,
  ) => {
    if (!school?.id) return;
    setUploadingField(field);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${school.id}/${slug}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('school-assets')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('school-assets').getPublicUrl(path);
      // Cache-bust so the new image shows immediately instead of a stale cached one.
      const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { data: updateData, error: updateError } = await supabase
        .from('schools' as any)
        .update({ [field]: bustedUrl })
        .eq('id', school.id)
        .select('id');
      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) {
        throw new Error("File uploaded, but saving it to your school record didn't go through — you may not have permission to edit school info.");
      }

      toast.success('Image updated');
      queryClient.invalidateQueries({ queryKey: ['school'] });
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingField(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>School Information</CardTitle>
        <CardDescription>Basic details about your institution</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>School Name</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>School Code</Label>
            <Input value={school?.school_code || ''} disabled />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <Label>Tagline / Motto</Label>
          <Input
            value={form.tagline}
            onChange={e => setForm({ ...form, tagline: e.target.value })}
            disabled={!canEdit}
            placeholder="e.g. Excellence in Character and Learning"
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">Shown under the school name on report cards, transcripts and broadsheets.</p>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        )}

        <div className="pt-4 border-t border-border grid gap-4 sm:grid-cols-3">
          <BrandingImageUpload
            label="School Logo"
            currentUrl={school?.logo_url}
            uploading={uploadingField === 'logo_url'}
            disabled={!canEdit}
            onSelect={(file) => handleImageUpload('logo_url', 'logo', file)}
          />
          <BrandingImageUpload
            label="Principal Signature"
            currentUrl={school?.principal_signature_url}
            uploading={uploadingField === 'principal_signature_url'}
            disabled={!canEdit}
            onSelect={(file) => handleImageUpload('principal_signature_url', 'signature', file)}
          />
          <BrandingImageUpload
            label="School Stamp"
            currentUrl={school?.school_stamp_url}
            uploading={uploadingField === 'school_stamp_url'}
            disabled={!canEdit}
            onSelect={(file) => handleImageUpload('school_stamp_url', 'stamp', file)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Signature and stamp appear at the bottom of report cards and transcripts. Use a transparent PNG for best results.
        </p>
      </CardContent>
    </Card>
  );
}

function BrandingImageUpload({
  label, currentUrl, uploading, disabled, onSelect,
}: {
  label: string;
  currentUrl?: string | null;
  uploading: boolean;
  disabled: boolean;
  onSelect: (file: File) => void;
}) {
  const inputId = `branding-upload-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-md border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {currentUrl ? (
            <img src={currentUrl} alt={label} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSelect(file);
              e.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} asChild={!disabled && !uploading}>
            <label htmlFor={inputId} className="cursor-pointer">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              {currentUrl ? 'Replace' : 'Upload'}
            </label>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: sessions, isLoading: sessionsLoading } = useAcademicSessions();

  const toggleSessionActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (isActive) {
        await supabase.from('academic_sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
      }
      const { error } = await supabase.from('academic_sessions').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
      toast.success('Session updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleTermActive = useMutation({
    mutationFn: async ({ id, isActive, sessionId }: { id: string; isActive: boolean; sessionId: string }) => {
      if (isActive) {
        await supabase.from('terms').update({ is_active: false }).eq('session_id', sessionId);
      }
      const { error } = await supabase.from('terms').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
      toast.success('Term updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteTerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('terms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
      toast.success('Term deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('terms').delete().eq('session_id', id);
      const { error } = await supabase.from('academic_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
      toast.success('Session deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage school configuration, academic calendar, and system settings</p>
      </div>

      <Tabs defaultValue="academic" className="space-y-6">
        <TabsList>
          <TabsTrigger value="academic" className="gap-2"><Calendar size={16} /> Academic Calendar</TabsTrigger>
          <TabsTrigger value="school" className="gap-2"><School size={16} /> School Info</TabsTrigger>
          <TabsTrigger value="system" className="gap-2"><Shield size={16} /> System</TabsTrigger>
          <TabsTrigger value="data" className="gap-2"><FileText size={16} /> Data & Security</TabsTrigger>
        </TabsList>

        {/* ─── Academic Calendar ─── */}
        <TabsContent value="academic" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Academic Sessions & Terms</h2>
              <p className="text-sm text-muted-foreground">Manage the school's academic calendar</p>
            </div>
            <AddSessionDialog onSuccess={refetch} />
          </div>

          {sessionsLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : sessions && sessions.length > 0 ? (
            <div className="space-y-4">
              {sessions.map((session: any) => (
                <Card key={session.id}>
                  <CardHeader className="flex flex-row items-start justify-between pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{session.name}</CardTitle>
                        {session.is_active && <Badge className="bg-success text-success-foreground">Active</Badge>}
                      </div>
                      <CardDescription>
                        {new Date(session.start_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })} — {new Date(session.end_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`session-${session.id}`} className="text-xs text-muted-foreground">Active</Label>
                        <Switch
                          id={`session-${session.id}`}
                          checked={session.is_active || false}
                          onCheckedChange={(checked) => toggleSessionActive.mutate({ id: session.id, isActive: checked })}
                        />
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Delete this session and all its terms?')) {
                            deleteSession.mutate(session.id);
                          }
                        }}
                       title="Delete">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Terms</h4>
                      <AddTermDialog sessionId={session.id} onSuccess={refetch} />
                    </div>
                    {session.terms && session.terms.length > 0 ? (
                      <div className="space-y-2">
                        {session.terms
                          .sort((a: any, b: any) => a.term_number - b.term_number)
                          .map((term: any) => (
                            <div key={term.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground">
                                  {term.term_number}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{term.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(term.start_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} — {new Date(term.end_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {term.is_active && <Badge variant="outline" className="text-xs text-success border-success">Current</Badge>}
                                <Switch
                                  checked={term.is_active || false}
                                  onCheckedChange={(checked) => toggleTermActive.mutate({ id: term.id, isActive: checked, sessionId: session.id })}
                                />
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                  onClick={() => {
                                    if (confirm('Delete this term?')) deleteTerm.mutate(term.id);
                                  }}
                                 title="Delete">
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No terms added yet</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No academic sessions created</p>
                <p className="text-sm text-muted-foreground/70">Create your first session to get started</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── School Info ─── */}
        <TabsContent value="school" className="space-y-6">
          <SchoolInfoCard />
          <GradingSystemCard />
        </TabsContent>

        {/* ─── System ─── */}
        <TabsContent value="system" className="space-y-6">
          <ProctorModeCard />
          <AccessRestrictionsCard />
          <AttendanceParametersCard />
          <StaffClockInQRCard />
          <Card>
            <CardHeader>
              <CardTitle>System Preferences</CardTitle>
              <CardDescription>Configure application behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow Late Submissions</p>
                  <p className="text-sm text-muted-foreground">Students can submit assignments after the due date</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-grade MCQ Quizzes</p>
                  <p className="text-sm text-muted-foreground">Automatically grade multiple choice and true/false questions</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show Results to Students</p>
                  <p className="text-sm text-muted-foreground">Allow students to view their quiz results immediately</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Notifications</p>
                  <p className="text-sm text-muted-foreground">Send in-app notifications for assignments and events</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Data & Security ─── */}
        <TabsContent value="data" className="space-y-6">
          <ExportDataCard />
          <AuditLogCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, CreditCard, Users, Download, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useSchool } from '@/contexts/SchoolContext';
import { useClassArms } from '@/hooks/useClassArms';
import { useStudents } from '@/hooks/useStudents';
import { useStudentFeeBalances } from '@/hooks/useStudentFees';
import { useStudentAttendanceAnalytics } from '@/hooks/useAttendanceAnalytics';
import {
  generateAttendanceSummaryPDF, generateFeesSummaryPDF, generateEnrollmentPDF,
} from '@/lib/pdf';

type ReportType = 'attendance' | 'fees' | 'enrollment';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

const REPORT_TYPES: Array<{ id: ReportType; title: string; description: string; icon: typeof ClipboardCheck }> = [
  { id: 'attendance', title: 'Attendance Summary', description: 'Present/late/absent/excused breakdown for a date range, whole-school or per-class', icon: ClipboardCheck },
  { id: 'fees', title: 'Outstanding Fees', description: 'Who owes what — current balances across every student, highest first', icon: CreditCard },
  { id: 'enrollment', title: 'Class Enrollment', description: 'Student roster per class, or the whole school', icon: Users },
];

export default function Reports() {
  const { school } = useSchool();
  const [activeReport, setActiveReport] = useState<ReportType | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Reports</h1>
        <p className="text-muted-foreground mt-1">Generate curated PDF reports for your school</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {REPORT_TYPES.map(({ id, title, description, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveReport(activeReport === id ? null : id)}
            className={`text-left rounded-xl border p-5 transition-all hover:shadow-md ${activeReport === id ? 'border-secondary bg-secondary/5 shadow-md' : 'border-border hover:border-secondary/50'}`}
          >
            <div className={`rounded-lg p-2 w-fit mb-3 ${activeReport === id ? 'bg-secondary text-secondary-foreground' : 'bg-primary/10 text-primary'}`}>
              <Icon size={20} />
            </div>
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </button>
        ))}
      </div>

      {activeReport === 'attendance' && school && <AttendanceReportPanel school={school} />}
      {activeReport === 'fees' && school && <FeesReportPanel school={school} />}
      {activeReport === 'enrollment' && school && <EnrollmentReportPanel school={school} />}
    </div>
  );
}

function AttendanceReportPanel({ school }: { school: any }) {
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [generating, setGenerating] = useState(false);

  const { data: classes = [] } = useClassArms();
  const { data, isLoading } = useStudentAttendanceAnalytics({
    from, to, classId: selectedClassId === 'all' ? null : selectedClassId,
  });

  const handleGenerate = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const scopeName = selectedClassId === 'all' ? 'All Classes' : (classes.find((c: any) => c.id === selectedClassId)?.name || 'Class');
      await generateAttendanceSummaryPDF(school, {
        range: { from, to },
        scope: scopeName,
        byStatus: data.byStatus,
        byStudent: data.byStudent.map(s => ({
          admission_number: s.admission_number,
          name: `${s.first_name} ${s.last_name}`,
          present: s.counts.present, absent: s.counts.absent, late: s.counts.late, excused: s.counts.excused,
          total: s.total,
        })),
      });
      toast.success('Attendance report downloaded');
    } catch (err: any) {
      toast.error('Failed to generate report: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ReportPanel title="Attendance Summary" icon={ClipboardCheck}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} min={from} max={todayISO()} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Class</Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerate} disabled={generating || isLoading || !data} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generate PDF
        </Button>
      </div>
      {data && (
        <p className="text-sm text-muted-foreground mt-3">
          {data.totalRecords} attendance records across {data.byStudent.length} students in this range.
        </p>
      )}
    </ReportPanel>
  );
}

function FeesReportPanel({ school }: { school: any }) {
  const { data: balances = [], isLoading } = useStudentFeeBalances();
  const [generating, setGenerating] = useState(false);

  const owingCount = useMemo(() => balances.filter(s => s.balance > 0).length, [balances]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateFeesSummaryPDF(school, {
        asOfDate: todayISO(),
        students: balances.map(s => ({
          admission_number: s.admission_number,
          name: `${s.first_name} ${s.last_name}`,
          class_name: s.class_name,
          total_owed: s.total_owed,
          total_paid: s.total_paid,
          balance: s.balance,
        })),
      });
      toast.success('Fees report downloaded');
    } catch (err: any) {
      toast.error('Failed to generate report: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ReportPanel title="Outstanding Fees" icon={CreditCard}>
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading balances…' : `${owingCount} of ${balances.length} students currently owe a balance.`}
        </p>
        <Button onClick={handleGenerate} disabled={generating || isLoading} className="gap-2 ml-auto">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generate PDF
        </Button>
      </div>
    </ReportPanel>
  );
}

function EnrollmentReportPanel({ school }: { school: any }) {
  const { data: students = [], isLoading } = useStudents();
  const { data: classes = [] } = useClassArms();
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [generating, setGenerating] = useState(false);

  const activeStudents = useMemo(
    () => students.filter((s: any) => s.enrollment_status === 'active'),
    [students]
  );

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const filtered = selectedClassId === 'all'
        ? activeStudents
        : activeStudents.filter((s: any) => s.class_id === selectedClassId);

      const byClass = new Map<string, { class_name: string; students: any[] }>();
      filtered.forEach((s: any) => {
        const className = s.class_arms?.name || 'Unassigned';
        if (!byClass.has(className)) byClass.set(className, { class_name: className, students: [] });
        byClass.get(className)!.students.push({
          admission_number: s.admission_number,
          name: `${s.first_name} ${s.last_name}`,
          gender: s.gender,
        });
      });

      const scopeName = selectedClassId === 'all' ? 'All Classes' : (classes.find((c: any) => c.id === selectedClassId)?.name || 'Class');
      await generateEnrollmentPDF(school, {
        scope: scopeName,
        classes: Array.from(byClass.values()).sort((a, b) => a.class_name.localeCompare(b.class_name)),
      });
      toast.success('Enrollment report downloaded');
    } catch (err: any) {
      toast.error('Failed to generate report: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ReportPanel title="Class Enrollment" icon={Users}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Class</Label>
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerate} disabled={generating || isLoading} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generate PDF
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-3">{activeStudents.length} active students school-wide.</p>
    </ReportPanel>
  );
}

function ReportPanel({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return (
    <Card className="border-secondary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Icon size={18} className="text-secondary" /> {title}</CardTitle>
        <CardDescription>Set the report parameters, then generate a PDF to download</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

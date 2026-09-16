import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeeStructures, usePayments, useStudentsForFees, useCreateFeeStructure, useUpdateFeeStructure, useDeleteFeeStructure, useRecordPayment } from '@/hooks/useFees';
import { useStudentFeeBalances } from '@/hooks/useStudentFees';
import { StudentFeeBalances } from '@/components/fees/StudentFeeBalances';
import { useExpenses, useCreateExpense, useDeleteExpense, EXPENSE_CATEGORIES } from '@/hooks/useExpenses';
import { useTerms } from '@/hooks/useAcademicData';
import { useClassArms } from '@/hooks/useClassArms';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { StatCard } from '@/components/dashboard/StatCard';
import { DollarSign, Plus, Receipt, CreditCard, TrendingUp, Users, Search, Pencil, Trash2, Wallet } from 'lucide-react';
import { format } from 'date-fns';

export default function Fees() {
  const { user } = useAuth();
  const { data: fees = [], isLoading: feesLoading } = useFeeStructures();
  const { data: payments = [], isLoading: paymentsLoading } = usePayments();
  const { data: students = [] } = useStudentsForFees();
  const { data: terms = [] } = useTerms();
  const { data: classes = [] } = useClassArms();
  const { data: expenses = [] } = useExpenses();
  const createFee = useCreateFeeStructure();
  const updateFee = useUpdateFeeStructure();
  const deleteFee = useDeleteFeeStructure();
  const recordPayment = useRecordPayment();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  const { data: balances = [] } = useStudentFeeBalances();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal' || user?.role === 'accountant';

  const totalPaid = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);
  // "Pending" now means real outstanding balance — fees owed minus
  // what's been paid — not the old meaning (sum of payment records
  // still awaiting confirmation, which is a different, narrower thing).
  const totalOutstanding = balances.reduce((s, b) => s + b.balance, 0);
  const pendingConfirmations = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="section-header">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fees & Payments</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Manage fee structures, payments, and school expenses' : 'View payments and fee information'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Paid" value={`₦${totalPaid.toLocaleString()}`} icon={DollarSign} variant="success" change={`${payments.length} payments`} changeType="neutral" />
        <StatCard
          title="Pending"
          value={`₦${totalOutstanding.toLocaleString()}`}
          icon={TrendingUp}
          variant="accent"
          change={pendingConfirmations > 0 ? `+₦${pendingConfirmations.toLocaleString()} awaiting confirmation` : undefined}
          changeType="neutral"
        />
        <StatCard title="Fee Items" value={fees.length} icon={Receipt} variant="primary" />
        {isAdmin ? (
          <StatCard title="Total Expenses" value={`₦${totalExpenses.toLocaleString()}`} icon={Wallet} variant="secondary" />
        ) : (
          <StatCard title="Students" value={students.length} icon={Users} variant="secondary" />
        )}
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="fee-structures">Fee Structures</TabsTrigger>
          {isAdmin && <TabsTrigger value="expenses">Expenses</TabsTrigger>}
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Payment Records</h2>
            {isAdmin && <RecordPaymentDialog students={students} fees={fees} onSubmit={recordPayment.mutateAsync} />}
          </div>
          <PaymentsTable payments={payments} loading={paymentsLoading} />
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          <StudentFeeBalances isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="fee-structures" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Fee Structures</h2>
            {isAdmin && <CreateFeeDialog classes={classes} terms={terms} onSubmit={createFee.mutateAsync} />}
          </div>
          <FeeStructuresTable fees={fees} loading={feesLoading} isAdmin={isAdmin} onUpdate={updateFee.mutateAsync} onDelete={deleteFee.mutateAsync} classes={classes} terms={terms} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="expenses" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">School Expenses</h2>
              <AddExpenseDialog onSubmit={createExpense.mutateAsync} />
            </div>
            <ExpensesTable expenses={expenses} onDelete={deleteExpense.mutateAsync} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

/* ── Payments Table ── */
function PaymentsTable({ payments, loading }: { payments: any[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const filtered = payments.filter(p => {
    const name = `${p.students?.first_name} ${p.students?.last_name}`.toLowerCase();
    const adm = p.students?.admission_number?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || adm.includes(search.toLowerCase());
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by student name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading payments...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No payments found</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.students?.first_name} {p.students?.last_name}</p>
                        <p className="text-xs text-muted-foreground">{p.students?.admission_number}</p>
                      </div>
                    </TableCell>
                    <TableCell>{p.fee_structures?.description || '—'}</TableCell>
                    <TableCell className="font-semibold">₦{Number(p.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{p.method?.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(p.payment_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'confirmed' ? 'default' : 'secondary'} className={p.status === 'confirmed' ? 'bg-success text-success-foreground' : ''}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.receipt_number || '—'}</TableCell>
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

/* ── Fee Structures Table ── */
function FeeStructuresTable({ fees, loading, isAdmin, onUpdate, onDelete, classes, terms }: {
  fees: any[]; loading: boolean; isAdmin: boolean;
  onUpdate: (v: any) => Promise<any>; onDelete: (id: string) => Promise<any>;
  classes: any[]; terms: any[];
}) {
  const [editingFee, setEditingFee] = useState<any>(null);

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : fees.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No fee structures defined yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount (₦)</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Mandatory</TableHead>
                  {isAdmin && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.description}</TableCell>
                    <TableCell className="font-semibold">₦{Number(f.amount).toLocaleString()}</TableCell>
                    <TableCell>{f.class_arms ? `${f.class_arms.name} ${f.class_arms.arm}` : 'All Classes'}</TableCell>
                    <TableCell>{f.terms?.name || 'All Terms'}</TableCell>
                    <TableCell>
                      <Badge variant={f.is_mandatory ? 'default' : 'outline'}>{f.is_mandatory ? 'Yes' : 'Optional'}</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingFee(f)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                            if (confirm('Delete this fee structure?')) onDelete(f.id);
                          }} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingFee && (
        <EditFeeDialog
          fee={editingFee}
          classes={classes}
          terms={terms}
          onSubmit={async (updates) => {
            await onUpdate({ id: editingFee.id, ...updates });
            setEditingFee(null);
          }}
          onClose={() => setEditingFee(null)}
        />
      )}
    </>
  );
}

/* ── Edit Fee Dialog ── */
function EditFeeDialog({ fee, classes, terms, onSubmit, onClose }: {
  fee: any; classes: any[]; terms: any[];
  onSubmit: (v: any) => Promise<any>; onClose: () => void;
}) {
  const [form, setForm] = useState({
    description: fee.description,
    amount: String(fee.amount),
    class_id: fee.class_id || 'all',
    term_id: fee.term_id || 'all',
    is_mandatory: fee.is_mandatory ?? true,
  });

  const handleSubmit = async () => {
    if (!form.description || !form.amount) return;
    await onSubmit({
      description: form.description,
      amount: parseFloat(form.amount),
      class_id: form.class_id === 'all' ? null : form.class_id,
      term_id: form.term_id === 'all' ? null : form.term_id,
      is_mandatory: form.is_mandatory,
    });
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Fee Structure</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Amount (₦)</Label>
            <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.arm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <Select value={form.term_id} onValueChange={v => setForm({ ...form, term_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="edit-mandatory" checked={form.is_mandatory} onChange={e => setForm({ ...form, is_mandatory: e.target.checked })} className="rounded" />
            <Label htmlFor="edit-mandatory">Mandatory fee</Label>
          </div>
          <Button onClick={handleSubmit} className="w-full">Update Fee Structure</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Create Fee Dialog ── */
function CreateFeeDialog({ classes, terms, onSubmit }: { classes: any[]; terms: any[]; onSubmit: (v: any) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', class_id: 'all', term_id: 'all', is_mandatory: true });

  const handleSubmit = async () => {
    if (!form.description || !form.amount) return;
    await onSubmit({
      description: form.description,
      amount: parseFloat(form.amount),
      class_id: form.class_id === 'all' ? null : form.class_id,
      term_id: form.term_id === 'all' ? null : form.term_id,
      is_mandatory: form.is_mandatory,
    });
    setForm({ description: '', amount: '', class_id: 'all', term_id: 'all', is_mandatory: true });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Fee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Fee Structure</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Tuition Fee" />
          </div>
          <div className="space-y-2">
            <Label>Amount (₦)</Label>
            <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={form.class_id} onValueChange={v => setForm({ ...form, class_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.arm}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <Select value={form.term_id} onValueChange={v => setForm({ ...form, term_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="mandatory" checked={form.is_mandatory} onChange={e => setForm({ ...form, is_mandatory: e.target.checked })} className="rounded" />
            <Label htmlFor="mandatory">Mandatory fee</Label>
          </div>
          <Button onClick={handleSubmit} className="w-full">Create Fee Structure</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Record Payment Dialog ── */
function RecordPaymentDialog({ students, fees, onSubmit }: { students: any[]; fees: any[]; onSubmit: (v: any) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ student_id: string; fee_id: string; amount: string; method: 'cash' | 'bank_transfer' | 'pos'; receipt_number: string; notes: string }>({
    student_id: '', fee_id: '', amount: '', method: 'cash', receipt_number: '', notes: ''
  });
  const [studentSearch, setStudentSearch] = useState('');

  const filteredStudents = students.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    return name.includes(studentSearch.toLowerCase()) || s.admission_number.toLowerCase().includes(studentSearch.toLowerCase());
  });

  const handleSubmit = async () => {
    if (!form.student_id || !form.fee_id || !form.amount) return;
    await onSubmit({
      student_id: form.student_id,
      fee_id: form.fee_id,
      amount: parseFloat(form.amount),
      method: form.method,
      receipt_number: form.receipt_number || undefined,
      notes: form.notes || undefined,
    });
    setForm({ student_id: '', fee_id: '', amount: '', method: 'cash', receipt_number: '', notes: '' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><CreditCard className="h-4 w-4 mr-1" /> Record Payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Student */}
          <div className="space-y-2">
            <Label>Student</Label>
            <div className="space-y-2">
              <Input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="h-9" />
              {form.student_id && (
                <Badge variant="secondary" className="gap-1">
                  {students.find(s => s.id === form.student_id)?.first_name} {students.find(s => s.id === form.student_id)?.last_name}
                  <button onClick={() => setForm({ ...form, student_id: '' })} className="ml-1 text-xs">✕</button>
                </Badge>
              )}
              {!form.student_id && studentSearch && (
                <div className="max-h-32 overflow-auto rounded-md border bg-popover p-1">
                  {filteredStudents.slice(0, 10).map(s => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                      onClick={() => { setForm({ ...form, student_id: s.id }); setStudentSearch(''); }}
                    >
                      {s.first_name} {s.last_name} <span className="text-muted-foreground">({s.admission_number})</span>
                    </button>
                  ))}
                  {filteredStudents.length === 0 && <p className="text-sm text-muted-foreground px-3 py-1.5">No students found</p>}
                </div>
              )}
            </div>
          </div>

          {/* Fee */}
          <div className="space-y-2">
            <Label>Fee Type</Label>
            <Select value={form.fee_id || undefined} onValueChange={v => {
              const fee = fees.find(f => f.id === v);
              setForm({ ...form, fee_id: v, amount: fee && Number(fee.amount) > 0 ? String(fee.amount) : form.amount });
            }}>
              <SelectTrigger><SelectValue placeholder="Select fee type" /></SelectTrigger>
              <SelectContent>
                {fees.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.description}{Number(f.amount) > 0 ? ` — ₦${Number(f.amount).toLocaleString()}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="Enter amount" />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={form.method} onValueChange={v => setForm({ ...form, method: v as 'cash' | 'bank_transfer' | 'pos' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Receipt Number (optional)</Label>
            <Input value={form.receipt_number} onChange={e => setForm({ ...form, receipt_number: e.target.value })} placeholder="e.g. REC-001" />
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <Button onClick={handleSubmit} className="w-full" disabled={!form.student_id || !form.fee_id || !form.amount}>
            Record Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Expenses Table ── */
function ExpensesTable({ expenses, onDelete }: { expenses: any[]; onDelete: (id: string) => Promise<any> }) {
  return (
    <Card>
      <CardContent className="pt-6">
        {expenses.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No expenses recorded yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount (₦)</TableHead>
                <TableHead>Paid To</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                  <TableCell className="font-semibold">₦{Number(e.amount).toLocaleString()}</TableCell>
                  <TableCell>{e.paid_to || '—'}</TableCell>
                  <TableCell>{format(new Date(e.payment_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={e.status === 'approved' ? 'default' : 'secondary'}>{e.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('Delete this expense?')) onDelete(e.id); }} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Add Expense Dialog ── */
function AddExpenseDialog({ onSubmit }: { onSubmit: (v: any) => Promise<any> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', category: 'general', payment_date: new Date().toISOString().split('T')[0], paid_to: '', receipt_number: '', notes: '' });

  const handleSubmit = async () => {
    if (!form.description || !form.amount) return;
    await onSubmit({
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      payment_date: form.payment_date,
      paid_to: form.paid_to || undefined,
      receipt_number: form.receipt_number || undefined,
      notes: form.notes || undefined,
    });
    setForm({ description: '', amount: '', category: 'general', payment_date: new Date().toISOString().split('T')[0], paid_to: '', receipt_number: '', notes: '' });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Generator fuel" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Salaries & Wages', 'Utilities', 'Maintenance & Repairs', 'Supplies & Materials', 'Transportation', 'Events & Activities', 'Equipment', 'Professional Services', 'Insurance', 'Miscellaneous'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Paid To</Label>
              <Input value={form.paid_to} onChange={e => setForm({ ...form, paid_to: e.target.value })} placeholder="Vendor/Person" />
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full">Record Expense</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

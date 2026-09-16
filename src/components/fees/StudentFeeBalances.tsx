import { useState, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ChevronDown, ChevronRight, Ban, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useStudentFeeBalances, useWaiveStudentFee, useOverrideStudentFeeAmount,
  useAddStudentFee, useRemoveStudentFee, StudentFeeLine,
} from '@/hooks/useStudentFees';
import { useFeeStructures } from '@/hooks/useFees';

export function StudentFeeBalances({ isAdmin }: { isAdmin: boolean }) {
  const { data: balances = [], isLoading } = useStudentFeeBalances();
  const { data: allFeeStructures = [] } = useFeeStructures();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrideLine, setOverrideLine] = useState<StudentFeeLine | null>(null);
  const [overrideValue, setOverrideValue] = useState('');
  const [addFeeStudentId, setAddFeeStudentId] = useState<string | null>(null);
  const [addFeeStructureId, setAddFeeStructureId] = useState('');

  const waiveFee = useWaiveStudentFee();
  const overrideAmount = useOverrideStudentFeeAmount();
  const addFee = useAddStudentFee();
  const removeFee = useRemoveStudentFee();

  const filtered = balances.filter(b =>
    `${b.first_name} ${b.last_name} ${b.admission_number}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = balances.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Total outstanding: <span className="font-semibold text-foreground">₦{totalOutstanding.toLocaleString()}</span>
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No students with fee assignments yet.</TableCell></TableRow>
              ) : (
                filtered.map((b) => (
                  <Fragment key={b.student_id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpanded(expanded === b.student_id ? null : b.student_id)}
                    >
                      <TableCell>
                        {expanded === b.student_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-medium">
                        {b.first_name} {b.last_name}
                        <span className="text-xs text-muted-foreground block">{b.admission_number}</span>
                      </TableCell>
                      <TableCell>{b.class_name}</TableCell>
                      <TableCell className="text-right">₦{b.total_owed.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-success">₦{b.total_paid.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={b.balance > 0 ? 'destructive' : 'secondary'}>
                          ₦{b.balance.toLocaleString()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {expanded === b.student_id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/20 p-4">
                          <div className="space-y-2">
                            {b.lines.map((line) => (
                              <div key={line.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                <div>
                                  <span className={line.waived ? 'line-through text-muted-foreground' : ''}>
                                    {line.fee_structures?.description || 'Unknown fee'}
                                  </span>
                                  {!line.auto_generated && <Badge variant="outline" className="ml-2 text-xs">manual</Badge>}
                                  {line.waived && <Badge variant="outline" className="ml-2 text-xs">waived{line.waived_reason ? `: ${line.waived_reason}` : ''}</Badge>}
                                  {line.custom_amount !== null && !line.waived && <Badge variant="outline" className="ml-2 text-xs">custom amount</Badge>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-medium">₦{line.effective_amount.toLocaleString()}</span>
                                  {isAdmin && (
                                    <div className="flex gap-1">
                                      <Button
                                        size="icon" variant="ghost" className="h-7 w-7"
                                        title={line.waived ? 'Unwaive' : 'Waive'}
                                        onClick={() => waiveFee.mutate({ id: line.id, waived: !line.waived })}
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon" variant="ghost" className="h-7 w-7"
                                        title="Override amount"
                                        onClick={() => { setOverrideLine(line); setOverrideValue(String(line.custom_amount ?? line.fee_structures?.amount ?? '')); }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                        title="Remove this fee from the student"
                                        onClick={() => removeFee.mutate(line.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {isAdmin && (
                              <Button size="sm" variant="outline" className="gap-2" onClick={() => setAddFeeStudentId(b.student_id)}>
                                <Plus className="h-3.5 w-3.5" /> Add fee
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Override amount dialog */}
      <Dialog open={!!overrideLine} onOpenChange={(o) => !o && setOverrideLine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override amount</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This only changes the amount for this student — the shared fee structure other students are billed against is untouched.
          </p>
          <Input
            type="number"
            value={overrideValue}
            onChange={(e) => setOverrideValue(e.target.value)}
            placeholder="Amount in ₦"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { if (overrideLine) overrideAmount.mutate({ id: overrideLine.id, amount: null }); setOverrideLine(null); }}
            >
              Clear override
            </Button>
            <Button
              onClick={() => {
                if (overrideLine && overrideValue) {
                  overrideAmount.mutate({ id: overrideLine.id, amount: Number(overrideValue) });
                }
                setOverrideLine(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add fee dialog */}
      <Dialog open={!!addFeeStudentId} onOpenChange={(o) => !o && setAddFeeStudentId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a fee to this student</DialogTitle>
          </DialogHeader>
          <Select value={addFeeStructureId} onValueChange={setAddFeeStructureId}>
            <SelectTrigger>
              <SelectValue placeholder="Select fee item" />
            </SelectTrigger>
            <SelectContent>
              {allFeeStructures.map((fs: any) => (
                <SelectItem key={fs.id} value={fs.id}>
                  {fs.description} — ₦{Number(fs.amount).toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              disabled={!addFeeStructureId}
              onClick={() => {
                if (addFeeStudentId && addFeeStructureId) {
                  addFee.mutate({ studentId: addFeeStudentId, feeStructureId: addFeeStructureId });
                }
                setAddFeeStudentId(null);
                setAddFeeStructureId('');
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

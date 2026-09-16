import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { QrCode, Search, Loader2, CheckCircle2, Camera, CameraOff, LogIn, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';

interface QRAttendanceScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCANNER_REGION_ID = 'qr-scanner-region';

export function QRAttendanceScanner({ open, onOpenChange }: QRAttendanceScannerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('daily');
  const [clockMode, setClockMode] = useState<'in' | 'out'>('in');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef<{ code: string; ts: number } | null>(null);
  const processingRef = useRef(false);

  // Stop camera on dialog close
  useEffect(() => {
    if (!open) {
      stopCamera();
      setLastScanned(null);
    }
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stopCamera = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch {}
    }
    setCameraOn(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          // Debounce duplicate scans within 2.5s
          const now = Date.now();
          if (lastCodeRef.current && lastCodeRef.current.code === decodedText && now - lastCodeRef.current.ts < 2500) return;
          lastCodeRef.current = { code: decodedText, ts: now };
          handleScan(decodedText);
        },
        () => { /* ignore decode errors per frame */ }
      );
      setCameraOn(true);
    } catch (err: any) {
      setCameraError(err?.message || 'Unable to access camera. Check permissions.');
      setCameraOn(false);
      scannerRef.current = null;
    }
  };

  const handleScan = async (rawValue?: string) => {
    const value = (rawValue ?? qrInput).trim();
    if (!value || !user || processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    try {
      const parts = value.split(':');
      const type = parts[0];
      // Supports both legacy "TYPE:id" and new tenant-scoped "TYPE:school_id:id"
      let payloadSchoolId: string | null = null;
      let id: string | undefined;
      if (parts.length >= 3) {
        payloadSchoolId = parts[1];
        id = parts[2];
      } else {
        id = parts[1];
      }

      if (!type || !id) {
        toast.error('Invalid QR code format');
        return;
      }

      // Reject cross-school QR before hitting the DB
      if (payloadSchoolId && user.schoolId && payloadSchoolId !== user.schoolId) {
        toast.error('QR code belongs to another school');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const periodValue = period === 'daily' ? null : parseInt(period, 10);

      if (type === 'STU') {
        const { data: student } = await supabase
          .from('students')
          .select('id, first_name, last_name, school_id')
          .eq('id', id)
          .maybeSingle();

        if (!student) {
          toast.error('Student not found');
          setLastScanned('Unknown student QR');
          return;
        }

        // Tenant guard
        if (user.schoolId && student.school_id && student.school_id !== user.schoolId) {
          toast.error('Student belongs to another school');
          return;
        }

        // Check existing for date + period via the RPC — a raw SELECT would need
        // attendance_records read access broadened back out for QR-scanning staff,
        // undoing Batch 3's form-teacher-only viewing scope, so this narrow
        // yes/no check is used instead of querying the table directly.
        const { data: alreadyMarked, error: checkError } = await supabase.rpc('attendance_already_marked', {
          _student_id: student.id,
          _date: today,
          _period: periodValue,
        });
        if (checkError) throw checkError;

        if (alreadyMarked) {
          const label = periodValue === null ? 'today' : `period ${periodValue}`;
          toast.info(`${student.first_name} ${student.last_name} already marked for ${label}`);
          setLastScanned(`${student.first_name} ${student.last_name} (already marked)`);
          return;
        }

        // Determine status: late if past attendance_parameters.late_after_minutes from school start of day (default 9:00)
        // Simple heuristic: late if time is past 8:30 local
        const now = new Date();
        const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);

        const { error } = await supabase
          .from('attendance_records')
          .insert({
            student_id: student.id,
            date: today,
            period: periodValue,
            status: (isLate ? 'late' : 'present') as any,
            marked_by: user.id,
            method: 'qr',
            notes: `QR scan${periodValue !== null ? ` (period ${periodValue})` : ''}`,
          });

        if (error) throw error;
        const status = isLate ? 'Late' : 'Present';
        setLastScanned(`${student.first_name} ${student.last_name} — ${status} ✓`);
        toast.success(`${student.first_name} marked ${status.toLowerCase()}`);
        queryClient.invalidateQueries({ queryKey: ['attendance'] });

      } else if (type === 'STAFF') {
        const { data: staff } = await supabase
          .from('staff')
          .select('id, first_name, last_name, school_id')
          .eq('id', id)
          .maybeSingle();

        if (!staff) {
          toast.error('Staff not found');
          return;
        }
        if (user.schoolId && (staff as any).school_id && (staff as any).school_id !== user.schoolId) {
          toast.error('Staff belongs to another school');
          return;
        }

        const { data: existingRaw } = await supabase
          .from('staff_clock_records' as any)
          .select('id, clock_out')
          .eq('staff_id', staff.id)
          .eq('date', today)
          .maybeSingle();

        const existing = existingRaw as any;

        // Explicit mode instead of auto-toggling on whatever state the
        // record happens to be in — an operator scanning several staff
        // badges back-to-back can't predict which of them already has a
        // record (e.g. someone self-clocked-in earlier via the other QR
        // flow), so auto-toggle meant some scans clocked people IN and
        // others clocked the very next person OUT in the same rapid
        // scanning pass. Clock In and Clock Out are now two separate,
        // deliberate modes the operator picks before scanning — morning
        // arrival round vs. departure round — matching how these are
        // actually run and how admin analytics needs to tell them apart.
        if (clockMode === 'in') {
          if (existing) {
            toast.info(`${staff.first_name} already has a clock-in record for today`);
            setLastScanned(`${staff.first_name} ${staff.last_name} (already clocked in)`);
          } else {
            await supabase
              .from('staff_clock_records' as any)
              .insert({ staff_id: staff.id, date: today, method: 'qr' });
            setLastScanned(`${staff.first_name} ${staff.last_name} — Clocked In ✓`);
            toast.success(`${staff.first_name} clocked in`);
          }
        } else {
          if (!existing) {
            toast.error(`${staff.first_name} hasn't clocked in yet today`);
            setLastScanned(`${staff.first_name} ${staff.last_name} (not clocked in)`);
          } else if (existing.clock_out) {
            toast.info(`${staff.first_name} already clocked out today`);
            setLastScanned(`${staff.first_name} ${staff.last_name} (already clocked out)`);
          } else {
            await supabase
              .from('staff_clock_records' as any)
              .update({ clock_out: new Date().toISOString() })
              .eq('id', existing.id);
            setLastScanned(`${staff.first_name} ${staff.last_name} — Clocked Out ✓`);
            toast.success(`${staff.first_name} clocked out`);
          }
        }
        queryClient.invalidateQueries({ queryKey: ['clock-records'] });
        queryClient.invalidateQueries({ queryKey: ['clock-record-today'] });
      } else {
        toast.error('Unknown QR code type');
      }
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setLoading(false);
      setQrInput('');
      // Allow next scan after brief cooldown to avoid double-processing
      setTimeout(() => { processingRef.current = false; }, 600);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-secondary" />
            QR Attendance Scanner
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Staff Clock Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={clockMode === 'in' ? 'default' : 'outline'}
                onClick={() => setClockMode('in')}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                Clock In
              </Button>
              <Button
                type="button"
                variant={clockMode === 'out' ? 'default' : 'outline'}
                onClick={() => setClockMode('out')}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Clock Out
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Applies to staff badge scans only — set this once per round (morning arrival vs. departure) rather than per person.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily (whole day)</SelectItem>
                {[1,2,3,4,5,6,7,8].map(p => (
                  <SelectItem key={p} value={String(p)}>Period {p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Applies to student badge scans only.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Camera Scanner</Label>
              <Button
                type="button"
                size="sm"
                variant={cameraOn ? 'destructive' : 'outline'}
                onClick={cameraOn ? stopCamera : startCamera}
                className="gap-2"
              >
                {cameraOn ? <><CameraOff className="h-4 w-4" /> Stop</> : <><Camera className="h-4 w-4" /> Start</>}
              </Button>
            </div>
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-square w-full">
              <div id={SCANNER_REGION_ID} className="absolute inset-0" />
              {!cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground p-4 pointer-events-none">
                  {cameraError ? <span className="text-destructive">{cameraError}</span> : 'Tap "Start" to scan with the camera.'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Or enter QR value manually</Label>
            <div className="flex gap-2">
              <Input
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="STU:uuid or STAFF:uuid"
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
              <Button onClick={() => handleScan()} disabled={loading || !qrInput.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {lastScanned && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">{lastScanned}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Tip: Use the camera for student/staff ID badges, or paste a code from a USB/Bluetooth scanner.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

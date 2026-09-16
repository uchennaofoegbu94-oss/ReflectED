import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMyStaffId } from '@/hooks/useMyStaffId';
import { toast } from 'sonner';
import { QrCode, Search, Loader2, CheckCircle2, Camera, CameraOff } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';

interface StaffSelfClockInProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCANNER_REGION_ID = 'self-clockin-scanner-region';

/**
 * Self-scan clock-in/out: staff scan the single admin-provided QR code printed
 * from Settings (value "CLOCK:STAFF" or tenant-scoped "CLOCK:STAFF:<school_id>")
 * with their own device, while logged in as themselves — no gate operator or
 * shared scanner device required. This is distinct from QRAttendanceScanner,
 * which is the operator-scans-someone-else's-badge flow.
 */
export function StaffSelfClockIn({ open, onOpenChange }: StaffSelfClockInProps) {
  const { user } = useAuth();
  const { data: myStaffId } = useMyStaffId();
  const queryClient = useQueryClient();
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef<{ code: string; ts: number } | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setLastResult(null);
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
      if (parts[0] !== 'CLOCK' || parts[1] !== 'STAFF') {
        toast.error('This isn\'t a clock-in code — ask an Admin for the Clock-In QR from Settings');
        return;
      }
      const payloadSchoolId = parts[2];
      if (payloadSchoolId && user.schoolId && payloadSchoolId !== user.schoolId) {
        toast.error('This clock-in QR belongs to another school');
        return;
      }
      if (!myStaffId) {
        toast.error('No staff record found for your account — contact an Admin');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('staff_clock_records' as any)
        .select('id, clock_out')
        .eq('staff_id', myStaffId)
        .eq('date', today)
        .maybeSingle();

      const existingRow = existing as any;

      if (existingRow && !existingRow.clock_out) {
        await supabase
          .from('staff_clock_records' as any)
          .update({ clock_out: new Date().toISOString() })
          .eq('id', existingRow.id);
        setLastResult('Clocked Out ✓');
        toast.success('Clocked out');
      } else if (existingRow && existingRow.clock_out) {
        toast.info('You already clocked in & out today');
        setLastResult('Already done for today');
      } else {
        await supabase
          .from('staff_clock_records' as any)
          .insert({ staff_id: myStaffId, date: today, method: 'self_qr' });
        setLastResult('Clocked In ✓');
        toast.success('Clocked in');
      }
      queryClient.invalidateQueries({ queryKey: ['clock-records'] });
      queryClient.invalidateQueries({ queryKey: ['clock-record-today'] });
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setLoading(false);
      setQrInput('');
      setTimeout(() => { processingRef.current = false; }, 600);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-secondary" />
            Clock In / Out
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Scan the Clock-In QR</Label>
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
                  {cameraError ? <span className="text-destructive">{cameraError}</span> : 'Tap "Start" and point at the Clock-In QR posted by your school.'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Or enter the code manually</Label>
            <div className="flex gap-2">
              <Input
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="CLOCK:STAFF"
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              />
              <Button onClick={() => handleScan()} disabled={loading || !qrInput.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {lastResult && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">{lastResult}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { QrCode, Search, Loader2, CheckCircle2, Camera, CameraOff, BookOpen, User as UserIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import { useCheckoutBook, useReturnBook } from '@/hooks/useLibrary';

interface LibraryScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SCANNER_REGION_ID = 'library-scanner-region';

function daysFromNowISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/**
 * Checkout supports the three input methods from the recorded requirements:
 * a library-generated QR stuck on the physical book, plain ISBN lookup
 * (typed or scanned via a barcode reader acting as a keyboard), and scanning
 * the borrower's existing student/staff ID QR — no new borrower-side QR is
 * generated, it reuses the STU:/STAFF: codes already used for attendance.
 */
export function LibraryScanner({ open, onOpenChange }: LibraryScannerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const checkoutBook = useCheckoutBook();
  const returnBook = useReturnBook();

  const [mode, setMode] = useState<'checkout' | 'return'>('checkout');
  const [step, setStep] = useState<'book' | 'borrower'>('book');
  const [scannedBook, setScannedBook] = useState<{ id: string; title: string; available_copies: number } | null>(null);
  const [scannedBorrower, setScannedBorrower] = useState<{ type: 'student' | 'staff'; id: string; name: string } | null>(null);
  const [dueDate, setDueDate] = useState(daysFromNowISO(14));
  const [manualInput, setManualInput] = useState('');
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
      reset();
    }
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const reset = () => {
    setStep('book');
    setScannedBook(null);
    setScannedBorrower(null);
    setLastResult(null);
    setManualInput('');
  };

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
        () => { /* ignore per-frame decode errors */ }
      );
      setCameraOn(true);
    } catch (err: any) {
      setCameraError(err?.message || 'Unable to access camera. Check permissions.');
      setCameraOn(false);
      scannerRef.current = null;
    }
  };

  const findBookByCode = async (value: string) => {
    const parts = value.split(':');
    if (parts[0] === 'BOOK' && parts[2]) {
      return supabase.from('library_books' as any).select('id, title, available_copies').eq('id', parts[2]).maybeSingle();
    }
    // Not a BOOK: QR — treat it as an ISBN (typed, or a barcode scanner acting as a keyboard).
    return supabase.from('library_books' as any).select('id, title, available_copies').eq('isbn', value).maybeSingle();
  };

  const handleScan = async (rawValue?: string) => {
    const value = (rawValue ?? manualInput).trim();
    if (!value || processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    try {
      if (step === 'book') {
        const { data: book, error } = await findBookByCode(value);
        if (error) throw error;
        if (!book) {
          toast.error('No matching book found — check the QR code or ISBN');
          return;
        }
        const b = book as any;
        if (mode === 'checkout') {
          if (b.available_copies <= 0) {
            toast.error(`"${b.title}" has no copies available right now`);
            return;
          }
          setScannedBook(b);
          setStep('borrower');
          setManualInput('');
        } else {
          // Return: find the active (unreturned) loan for this book.
          const { data: loan, error: loanErr } = await supabase
            .from('library_loans' as any)
            .select('id, student:student_id(first_name, last_name), staff:staff_id(first_name, last_name)')
            .eq('book_id', b.id)
            .is('returned_at', null)
            .order('borrowed_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (loanErr) throw loanErr;
          if (!loan) {
            toast.info(`"${b.title}" doesn't have an active loan to return`);
            return;
          }
          await returnBook.mutateAsync((loan as any).id);
          const borrower = (loan as any).student || (loan as any).staff;
          setLastResult(`Returned: ${b.title}${borrower ? ` (from ${borrower.first_name} ${borrower.last_name})` : ''}`);
        }
      } else if (step === 'borrower' && scannedBook) {
        const parts = value.split(':');
        if (parts[0] !== 'STU' && parts[0] !== 'STAFF') {
          toast.error('Scan the borrower\'s student or staff ID QR');
          return;
        }
        const borrowerId = parts[2];
        const table = parts[0] === 'STU' ? 'students' : 'staff';
        const { data: person, error } = await supabase
          .from(table as any).select('first_name, last_name').eq('id', borrowerId).maybeSingle();
        if (error) throw error;
        if (!person) {
          toast.error('Borrower not found');
          return;
        }
        const p = person as any;
        await checkoutBook.mutateAsync({
          book_id: scannedBook.id,
          ...(parts[0] === 'STU' ? { student_id: borrowerId } : { staff_id: borrowerId }),
          due_date: dueDate,
        });
        setLastResult(`Checked out: ${scannedBook.title} → ${p.first_name} ${p.last_name}`);
        setScannedBook(null);
        setStep('book');
      }
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setLoading(false);
      setManualInput('');
      setTimeout(() => { processingRef.current = false; }, 600);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-secondary" />
            Library Checkout / Return
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'checkout' | 'return')}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="checkout">Checkout</TabsTrigger>
            <TabsTrigger value="return">Return</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'checkout' && (
          <div className="flex items-center gap-2 text-sm">
            <div className={`flex items-center gap-1.5 ${step === 'book' ? 'text-secondary font-medium' : 'text-muted-foreground'}`}>
              <BookOpen size={14} /> 1. Scan Book
            </div>
            <span className="text-muted-foreground">→</span>
            <div className={`flex items-center gap-1.5 ${step === 'borrower' ? 'text-secondary font-medium' : 'text-muted-foreground'}`}>
              <UserIcon size={14} /> 2. Scan Borrower
            </div>
          </div>
        )}
        {scannedBook && (
          <div className="rounded-lg bg-muted p-2 text-sm">
            Book: <span className="font-medium">{scannedBook.title}</span>
          </div>
        )}
        {mode === 'checkout' && step === 'borrower' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={daysFromNowISO(1)} />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{step === 'book' ? 'Scan Book QR or Barcode' : "Scan Borrower's ID QR"}</Label>
            <Button type="button" size="sm" variant={cameraOn ? 'destructive' : 'outline'} onClick={cameraOn ? stopCamera : startCamera} className="gap-2">
              {cameraOn ? <><CameraOff className="h-4 w-4" /> Stop</> : <><Camera className="h-4 w-4" /> Start</>}
            </Button>
          </div>
          <div className="relative rounded-lg overflow-hidden bg-muted aspect-square w-full">
            <div id={SCANNER_REGION_ID} className="absolute inset-0" />
            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground p-4 pointer-events-none">
                {cameraError ? <span className="text-destructive">{cameraError}</span> : 'Tap "Start" and scan.'}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{step === 'book' ? 'Or enter ISBN manually' : 'Or enter borrower code manually'}</Label>
          <div className="flex gap-2">
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder={step === 'book' ? 'ISBN' : 'STU:... or STAFF:...'}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            />
            <Button onClick={() => handleScan()} disabled={loading || !manualInput.trim()}>
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
      </DialogContent>
    </Dialog>
  );
}

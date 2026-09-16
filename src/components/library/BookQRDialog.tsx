import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useSchool } from '@/contexts/SchoolContext';

interface BookQRDialogProps {
  book: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Library-generated QR to print and stick on the physical book, per the
 * recorded requirement — value shape matches the STU:/STAFF:/CLOCK: pattern
 * already used elsewhere in the app. */
export function BookQRDialog({ book, open, onOpenChange }: BookQRDialogProps) {
  const { school } = useSchool();
  const qrValue = `BOOK:${school?.id || ''}:${book.id}`;

  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base">{book.title}</DialogTitle>
        </DialogHeader>
        <div id="book-qr-print" className="flex flex-col items-center gap-3 py-4">
          <QRCodeSVG value={qrValue} size={180} />
          <p className="text-sm text-center font-medium">{book.title}</p>
        </div>
        <Button onClick={handlePrint} className="gap-2">
          <Printer size={16} /> Print
        </Button>
      </DialogContent>
    </Dialog>
  );
}

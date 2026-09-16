import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode } from 'lucide-react';

interface StudentQRCodeProps {
  type: 'STU' | 'STAFF';
  id: string;
  name: string;
  subtitle?: string;
  schoolId?: string | null;
}

export function StudentQRCode({ type, id, name, subtitle, schoolId }: StudentQRCodeProps) {
  // Tenant-scoped payload: TYPE:school_id:entity_id (falls back to legacy if no school)
  const qrValue = schoolId ? `${type}:${schoolId}:${id}` : `${type}:${id}`;

  return (
    <Card className="w-fit">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <QrCode className="h-4 w-4 text-secondary" />
          My Attendance QR
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2">
        <div className="bg-white p-3 rounded-lg">
          <QRCodeSVG value={qrValue} size={120} level="M" />
        </div>
        <p className="text-xs text-muted-foreground text-center font-medium">{name}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

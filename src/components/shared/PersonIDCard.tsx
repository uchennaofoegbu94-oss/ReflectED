import { QRCodeSVG } from 'qrcode.react';

export interface IDCardPerson {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  admission_number?: string;
  employee_id?: string;
}

interface IDCardFrontProps {
  person: IDCardPerson;
  type: 'student' | 'staff';
  schoolName: string;
  schoolLogo?: string | null;
  className?: string;
}

// Extracted from IDCards.tsx (the admin bulk-print tool) so the printed
// card and the in-app digital ID are guaranteed to look the same instead
// of two hand-maintained copies drifting apart. Kept as plain inline
// styles (not Tailwind classes) because this markup is also serialized
// into a print window's innerHTML in IDCards.tsx, where Tailwind's
// classes wouldn't resolve to anything without the app's stylesheet.
export function IDCardFront({ person, type, schoolName, schoolLogo, className }: IDCardFrontProps) {
  return (
    <div className="id-card" style={{ width: '3.375in', height: '2.125in', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '12px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {schoolLogo ? (
        <img src={schoolLogo} alt={schoolName} style={{ height: 22, width: 'auto', objectFit: 'contain', marginBottom: 2 }} />
      ) : null}
      <p style={{ fontSize: '10px', color: 'hsl(var(--secondary))', fontWeight: 600 }}>{schoolName}</p>
      {person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt={`${person.first_name} ${person.last_name}`}
          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold', color: 'hsl(var(--muted-foreground))' }}>
          {person.first_name.charAt(0)}{person.last_name.charAt(0)}
        </div>
      )}
      <p style={{ fontSize: '14px', fontWeight: 'bold', marginTop: 6 }}>{person.first_name} {person.last_name}</p>
      <p style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
        {type === 'student' ? person.admission_number : person.employee_id}
      </p>
      {className && <p style={{ fontSize: '10px', color: 'hsl(var(--muted-foreground))' }}>{className}</p>}
    </div>
  );
}

export function buildIdCardQrValue(type: 'student' | 'staff', personId: string, schoolId?: string | null) {
  const prefix = type === 'student' ? 'STU' : 'STAFF';
  return schoolId ? `${prefix}:${schoolId}:${personId}` : `${prefix}:${personId}`;
}

interface IDCardBackProps {
  person: IDCardPerson;
  type: 'student' | 'staff';
  schoolName: string;
  schoolId?: string | null;
}

export function IDCardBack({ person, type, schoolName, schoolId }: IDCardBackProps) {
  return (
    <div className="id-card-back" style={{ width: '3.375in', height: '2.125in', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '12px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <QRCodeSVG value={buildIdCardQrValue(type, person.id, schoolId)} size={80} level="M" />
      <p style={{ fontSize: '9px', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>Scan for Attendance</p>
      <p style={{ fontSize: '10px', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{schoolName}</p>
    </div>
  );
}

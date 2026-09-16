import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useStudents } from '@/hooks/useStudents';
import { useStaff } from '@/hooks/useStaff';
import { useClassArms } from '@/hooks/useClassArms';
import { Search, Printer, CreditCard, Loader2, Users, GraduationCap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IDCardFront, IDCardBack, buildIdCardQrValue } from '@/components/shared/PersonIDCard';

export default function IDCards() {
  const { user } = useAuth();
  const { school } = useSchool();
  const schoolName = school?.name || 'School';
  const schoolLogo = school?.logo_url || null;
  const schoolId = school?.id || user?.schoolId || null;
  const { data: students = [], isLoading: studentsLoading } = useStudents();
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const { data: classArms = [] } = useClassArms();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewPerson, setPreviewPerson] = useState<{ person: any; type: 'student' | 'staff'; className?: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const singlePrintRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Only administrators can access ID card management.
      </div>
    );
  }

  const getClassName = (classId: string | null) => {
    if (!classId) return 'No Class';
    const cls = classArms.find(c => c.id === classId);
    return cls ? `${cls.name} ${cls.arm}` : 'Unknown';
  };

  const filteredStudents = students.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || s.admission_number.includes(searchQuery);
    const matchesClass = selectedClass === 'all' || s.class_id === selectedClass;
    return matchesSearch && matchesClass;
  });

  const filteredStaff = staff.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || s.employee_id.includes(searchQuery);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePrintContent = (ref: React.RefObject<HTMLDivElement>) => {
    const printContent = ref.current;
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>ID Cards</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; }
        .id-card, .id-card-back { width: 3.375in; height: 2.125in; border: 1px solid #ccc; border-radius: 8px; padding: 12px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; margin: 8px; page-break-inside: avoid; }
        .name { font-size: 14px; font-weight: bold; margin: 6px 0 2px; }
        .detail { font-size: 11px; color: #666; }
        .school { font-size: 10px; color: #1FA4A9; font-weight: 600; margin-bottom: 4px; }
        .qr-label { font-size: 9px; color: #999; margin-top: 4px; }
        @media print { .no-print { display: none; } }
      </style></head><body>
      ${printContent.innerHTML}
      <script>window.print(); window.close();<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const IDCardFrontLocal = ({ person, type, className }: { person: any; type: 'student' | 'staff'; className?: string }) => (
    <IDCardFront person={person} type={type} schoolName={schoolName} schoolLogo={schoolLogo} className={className} />
  );

  const buildQrValue = (type: 'student' | 'staff', personId: string) => buildIdCardQrValue(type, personId, schoolId);

  const IDCardBackLocal = ({ person, type }: { person: any; type: 'student' | 'staff' }) => (
    <IDCardBack person={person} type={type} schoolName={schoolName} schoolId={schoolId} />
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">ID Cards</h1>
          <p className="text-muted-foreground mt-1">Generate and print student & staff ID cards with QR codes</p>
        </div>
        <Button onClick={() => handlePrintContent(printRef)} disabled={selectedIds.size === 0} className="gap-2">
          <Printer size={18} />
          Print Selected ({selectedIds.size})
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classArms.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name} {cls.arm}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => {
              const allIds = [...filteredStudents.map(s => `stu-${s.id}`), ...filteredStaff.map(s => `staff-${s.id}`)];
              setSelectedIds(new Set(allIds));
            }}>Select All</Button>
            <Button variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students" className="gap-2"><Users size={16} /> Students ({filteredStudents.length})</TabsTrigger>
          <TabsTrigger value="staff" className="gap-2"><GraduationCap size={16} /> Staff ({filteredStaff.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          {studentsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredStudents.map(student => (
                <Card
                  key={student.id}
                  className={`cursor-pointer transition-all ${selectedIds.has(`stu-${student.id}`) ? 'ring-2 ring-secondary' : ''}`}
                  onClick={(e) => {
                    if (e.detail === 2) {
                      // Double click - preview
                      setPreviewPerson({ person: student, type: 'student', className: getClassName(student.class_id) });
                    } else {
                      toggleSelect(`stu-${student.id}`);
                    }
                  }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={student.avatar_url || undefined} />
                      <AvatarFallback>{student.first_name.charAt(0)}{student.last_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{student.first_name} {student.last_name}</p>
                      <p className="text-xs text-muted-foreground">{student.admission_number} • {getClassName(student.class_id)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewPerson({ person: student, type: 'student', className: getClassName(student.class_id) });
                        }}
                       title="Generate ID card">
                        <CreditCard size={16} className="text-secondary" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          {staffLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredStaff.map(member => (
                <Card
                  key={member.id}
                  className={`cursor-pointer transition-all ${selectedIds.has(`staff-${member.id}`) ? 'ring-2 ring-secondary' : ''}`}
                  onClick={(e) => {
                    if (e.detail === 2) {
                      setPreviewPerson({ person: member, type: 'staff' });
                    } else {
                      toggleSelect(`staff-${member.id}`);
                    }
                  }}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback>{member.first_name.charAt(0)}{member.last_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{member.first_name} {member.last_name}</p>
                      <p className="text-xs text-muted-foreground">{member.employee_id}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewPerson({ person: member, type: 'staff' });
                      }}
                     title="Generate ID card">
                      <CreditCard size={16} className="text-secondary" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ID Card Preview Dialog */}
      <Dialog open={!!previewPerson} onOpenChange={(open) => !open && setPreviewPerson(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ID Card Preview</DialogTitle>
          </DialogHeader>
          {previewPerson && (
            <div className="flex flex-col items-center gap-4">
              <div className="border border-border rounded-lg overflow-hidden">
                <IDCardFrontLocal person={previewPerson.person} type={previewPerson.type} className={previewPerson.className} />
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <IDCardBackLocal person={previewPerson.person} type={previewPerson.type} />
              </div>
              {/* Hidden print content for single card */}
              <div ref={singlePrintRef} style={{ display: 'none' }}>
                <IDCardFrontLocal person={previewPerson.person} type={previewPerson.type} className={previewPerson.className} />
                <IDCardBackLocal person={previewPerson.person} type={previewPerson.type} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => handlePrintContent(singlePrintRef)} className="gap-2">
              <Printer size={16} /> Print This Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden print area for bulk */}
      <div ref={printRef} style={{ display: 'none' }}>
        {Array.from(selectedIds).map(key => {
          const [type, ...rest] = key.split('-');
          const id = rest.join('-');
          if (type === 'stu') {
            const student = students.find(s => s.id === id);
            if (!student) return null;
            return (
              <div key={key} style={{ display: 'inline-block' }}>
                <IDCardFrontLocal person={student} type="student" className={getClassName(student.class_id)} />
                <IDCardBackLocal person={student} type="student" />
              </div>
            );
          } else {
            const member = staff.find(s => s.id === id);
            if (!member) return null;
            return (
              <div key={key} style={{ display: 'inline-block' }}>
                <IDCardFrontLocal person={member} type="staff" />
                <IDCardBackLocal person={member} type="staff" />
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

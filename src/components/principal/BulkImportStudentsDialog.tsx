import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useClassArms } from '@/hooks/useClassArms';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkImportStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedStudent {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName: string;
  gender: string;
  dateOfBirth: string;
  className: string;
  admissionNumber: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export function BulkImportStudentsDialog({ open, onOpenChange }: BulkImportStudentsDialogProps) {
  const queryClient = useQueryClient();
  const { data: classArms = [] } = useClassArms();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const downloadTemplate = () => {
    const headers = 'email,password,first_name,last_name,middle_name,gender,date_of_birth,class_name,admission_number';
    const classExample = classArms.length > 0 ? `${classArms[0].name} ${classArms[0].arm}` : 'JSS1 A';
    const example = `student@school.com,password123,Jane,Doe,,female,2010-05-15,${classExample},STU-001`;
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): ParsedStudent[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      return {
        email: cols[0] || '',
        password: cols[1] || '',
        firstName: cols[2] || '',
        lastName: cols[3] || '',
        middleName: cols[4] || '',
        gender: (cols[5] || 'male').toLowerCase(),
        dateOfBirth: cols[6] || '',
        className: cols[7] || '',
        admissionNumber: cols[8] || '',
      };
    });
  };

  const resolveClassId = (className: string): string | null => {
    if (!className) return null;
    const match = classArms.find(c => `${c.name} ${c.arm}`.toLowerCase() === className.toLowerCase());
    return match?.id || null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const data = parseCSV(text);
      setParsedData(data);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);
    const importResult: ImportResult = { success: 0, failed: 0, errors: [] };

    const { data: currentSession } = await supabase.auth.getSession();
    const accessToken = currentSession?.session?.access_token;

    for (const student of parsedData) {
      try {
        if (!student.email || !student.password || !student.firstName || !student.lastName) {
          throw new Error(`Missing required fields for ${student.email || 'unknown'}`);
        }

        if (student.gender !== 'male' && student.gender !== 'female') {
          throw new Error(`Invalid gender "${student.gender}" - must be male or female`);
        }

        const classId = resolveClassId(student.className);

        // Create the auth user + role server-side via the service role —
        // never touches this admin's own session, unlike the old
        // signUp()+setSession() loop this replaced, which re-hijacked and
        // restored the session on every single row.
        const { data: fnResult, error: fnError } = await supabase.functions.invoke('create-student-account', {
          body: {
            email: student.email,
            password: student.password,
            full_name: `${student.firstName} ${student.lastName}`,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (fnError) throw fnError;
        if (fnResult?.error) throw new Error(fnResult.error);

        const userId = fnResult.user_id;

        // Create student record
        const admNo = student.admissionNumber || `STU-${Date.now().toString().slice(-6)}`;
        const { error: studentError } = await supabase.from('students').insert({
          user_id: userId,
          first_name: student.firstName,
          last_name: student.lastName,
          middle_name: student.middleName || null,
          gender: student.gender as 'male' | 'female',
          date_of_birth: student.dateOfBirth || null,
          class_id: classId,
          admission_number: admNo,
          enrollment_status: 'active',
        });

        if (studentError) throw studentError;

        importResult.success++;
      } catch (err: any) {
        importResult.failed++;
        importResult.errors.push(`${student.email}: ${err.message}`);
      }
    }

    setResult(importResult);
    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ['students'] });

    if (importResult.success > 0) {
      toast.success(`${importResult.success} student(s) imported successfully`);
    }
    if (importResult.failed > 0) {
      toast.error(`${importResult.failed} student(s) failed to import`);
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setParsedData([]);
      setResult(null);
      setFileName('');
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Students</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple students at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" className="gap-2 w-full" onClick={downloadTemplate}>
            <Download size={16} />
            Download CSV Template
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              className="gap-2 w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              {fileName || 'Select CSV File'}
            </Button>
          </div>

          {parsedData.length > 0 && !result && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found <strong>{parsedData.length}</strong> student(s) in the file. Ready to import.
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-2">
              {result.success > 0 && (
                <Alert className="border-success/30">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription>{result.success} student(s) imported successfully.</AlertDescription>
                </Alert>
              )}
              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-1">{result.failed} failed:</p>
                    <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                      {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button onClick={handleImport} disabled={isImporting || parsedData.length === 0}>
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {parsedData.length} Student(s)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

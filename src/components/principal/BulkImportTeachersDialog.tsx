import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkImportTeachersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTeacher {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  gender: string;
  qualification: string;
  employeeId: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export function BulkImportTeachersDialog({ open, onOpenChange }: BulkImportTeachersDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedTeacher[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');

  const downloadTemplate = () => {
    const headers = 'email,password,first_name,last_name,middle_name,phone,gender,qualification,employee_id';
    const example = 'teacher@school.com,password123,John,Doe,,08012345678,male,B.Ed,TCH-001';
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teachers_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): ParsedTeacher[] => {
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
        phone: cols[5] || '',
        gender: (cols[6] || 'male').toLowerCase(),
        qualification: cols[7] || '',
        employeeId: cols[8] || '',
      };
    });
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

    for (const teacher of parsedData) {
      try {
        if (!teacher.email || !teacher.password || !teacher.firstName || !teacher.lastName) {
          throw new Error(`Missing required fields for ${teacher.email || 'unknown'}`);
        }

        // Server-side via the edge function — creates the auth user with the
        // admin API, which never touches this browser's own session, unlike
        // the old signUp()+setSession() loop this replaced (which re-hijacked
        // and restored the admin's session on every single row, and left it
        // broken if a mid-loop restore ever failed).
        const empId = teacher.employeeId || `TCH-${Date.now().toString().slice(-6)}`;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-staff-member`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              email: teacher.email,
              password: teacher.password,
              full_name: `${teacher.firstName} ${teacher.lastName}`,
              role: 'teacher',
              employee_id: empId,
              first_name: teacher.firstName,
              last_name: teacher.lastName,
              middle_name: teacher.middleName || null,
              phone: teacher.phone || null,
              gender: teacher.gender || 'male',
              qualification: teacher.qualification || null,
            }),
          }
        );
        const fnResult = await res.json();
        if (!res.ok || fnResult?.error) throw new Error(fnResult?.error || 'Failed to create teacher account');

        importResult.success++;
      } catch (err: any) {
        importResult.failed++;
        importResult.errors.push(`${teacher.email}: ${err.message}`);
      }
    }

    setResult(importResult);
    setIsImporting(false);

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['staff'] }),
      queryClient.invalidateQueries({ queryKey: ['teachers'] }),
    ]);

    if (importResult.success > 0) {
      toast.success(`${importResult.success} teacher(s) imported successfully`);
    }
    if (importResult.failed > 0) {
      toast.error(`${importResult.failed} teacher(s) failed to import`);
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
          <DialogTitle>Bulk Import Teachers</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple teachers at once.
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
                Found <strong>{parsedData.length}</strong> teacher(s) in the file. Ready to import.
              </AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="space-y-2">
              {result.success > 0 && (
                <Alert className="border-success/30">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription>{result.success} teacher(s) imported successfully.</AlertDescription>
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
                Import {parsedData.length} Teacher(s)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

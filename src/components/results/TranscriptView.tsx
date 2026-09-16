import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Search, GraduationCap, ChevronsUpDown, Check, Lock, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudents } from '@/hooks/useStudents';
import { useStudentTranscript } from '@/hooks/useResults';
import {
  useReportCardCustomFields, useReportCardCustomFieldScoresForTerms,
  useGradeSourceField, useGradeSourceScoresForTerms, useGradingScales, lookupGrade,
} from '@/hooks/useBroadsheetFields';
import { useTranscriptAccess, useCanDownloadTranscript } from '@/hooks/useAccessRestrictions';
import { useSchool } from '@/contexts/SchoolContext';
import { generateTranscriptPDF } from '@/lib/pdf';
import { toast } from 'sonner';

export function TranscriptView() {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { data: students = [] } = useStudents();
  const { data: transcriptData, isLoading } = useStudentTranscript(selectedStudentId || undefined);
  const { data: customFields = [] } = useReportCardCustomFields();
  const termIds = useMemo(
    () => (transcriptData?.transcripts as any[] | undefined)?.map(t => t.term_id) || [],
    [transcriptData],
  );
  const { data: customFieldScores = [] } = useReportCardCustomFieldScoresForTerms(selectedStudentId || undefined, termIds);
  const customScoreFor = (termId: string, subjectId: string, fieldId: string) =>
    customFieldScores.find(s => s.term_id === termId && s.subject_id === subjectId && s.field_id === fieldId)?.score ?? null;

  // Same grade-source precedence as Report Card — see there for why.
  const { data: gradeSourceField } = useGradeSourceField();
  const { data: gradeSourceScores = [] } = useGradeSourceScoresForTerms(gradeSourceField?.id, selectedStudentId || undefined, termIds);
  const { data: gradingScales = [] } = useGradingScales();
  const gradeFor = (termId: string, subjectId: string, legacyGrade: string | null) => {
    if (gradeSourceField) {
      const score = gradeSourceScores.find(s => s.term_id === termId && s.subject_id === subjectId)?.score ?? null;
      const band = lookupGrade(gradingScales, score);
      return band?.grade ?? null;
    }
    return legacyGrade;
  };

  const { isBlocked, isLoading: accessLoading } = useTranscriptAccess();
  // Transcript viewers are always staff (there's no parent/student self-view
  // for transcripts), so this gates the Download button directly.
  const { canDownload, isLoading: downloadPermLoading } = useCanDownloadTranscript();
  const { school } = useSchool();

  const selectedStudent = useMemo(
    () => (students as any[]).find(s => s.id === selectedStudentId),
    [students, selectedStudentId],
  );

  const handleDownload = async () => {
    if (!school || !selectedStudent || !transcriptData?.transcripts?.length) return;
    setDownloading(true);
    try {
      await generateTranscriptPDF(school, {
        student: {
          first_name: selectedStudent.first_name,
          last_name: selectedStudent.last_name,
          admission_number: selectedStudent.admission_number,
          class_name: selectedStudent.class_arms?.name,
          avatar_url: selectedStudent.avatar_url,
        },
        terms: (transcriptData.transcripts as any[]).map(t => ({
          session_name: t.academic_sessions?.name || '',
          term_name: t.terms?.name || '',
          total_subjects: t.total_subjects,
          total_score: t.total_score,
          average_score: t.average_score,
          position: t.position,
          class_size: t.class_size,
          subjects: t.subjects || [],
        })),
      });
      toast.success('Transcript downloaded');
    } catch (err: any) {
      toast.error('Failed to generate transcript: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (!accessLoading && isBlocked) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium text-foreground">Transcripts are currently restricted</p>
          <p className="text-sm mt-1">Please check back later, or contact an Admin/Principal.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Generate Transcripts
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Select a student to view their complete academic transcript including all terms and sessions.
            </p>
          </div>
          {!!transcriptData?.transcripts?.length && !downloadPermLoading && canDownload && (
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading || !school} className="shrink-0">
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Student search/picker */}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={pickerOpen}
              className="w-full sm:w-80 justify-between"
            >
              {selectedStudent
                ? `${selectedStudent.first_name} ${selectedStudent.last_name} — ${selectedStudent.admission_number}`
                : 'Search for a student...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0">
            <Command>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <CommandInput placeholder="Search by name or admission no..." className="border-0 focus:ring-0" />
              </div>
              <CommandList>
                <CommandEmpty>No student found.</CommandEmpty>
                {Object.entries(
                  (students as any[]).reduce((groups: Record<string, any[]>, student) => {
                    const className = student.class_arms?.name || 'Unassigned';
                    (groups[className] ||= []).push(student);
                    return groups;
                  }, {})
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([className, classStudents]) => (
                    <CommandGroup key={className} heading={className}>
                      {classStudents.map((student) => (
                        <CommandItem
                          key={student.id}
                          value={`${student.first_name} ${student.last_name} ${student.admission_number}`}
                          onSelect={() => {
                            setSelectedStudentId(student.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedStudentId === student.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{student.first_name} {student.last_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {student.admission_number}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {!selectedStudentId ? (
          <div className="text-center py-12 text-muted-foreground">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            Search for and select a student above to generate their transcript
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !transcriptData?.transcripts?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            No published results yet for this student. Results appear here once a term's
            broadsheet has been "Published to Transcripts."
          </div>
        ) : (
          <div className="space-y-8">
            {selectedStudent && (
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarImage src={(selectedStudent as any).avatar_url || undefined} alt={selectedStudent.first_name} />
                  <AvatarFallback>{selectedStudent.first_name?.[0]}{selectedStudent.last_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                  <div>
                    <p className="text-sm text-muted-foreground">Student Name</p>
                    <p className="font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admission No.</p>
                    <p className="font-medium">{selectedStudent.admission_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Class</p>
                    <p className="font-medium">{(selectedStudent as any).class_arms?.name || '-'}</p>
                  </div>
                </div>
              </div>
            )}
            {(transcriptData.transcripts as any[]).map((term) => (
              <div key={term.id}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-foreground">
                      {term.academic_sessions?.name} • {term.terms?.name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {term.total_subjects} subjects
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Avg: {Number(term.average_score).toFixed(1)}%</Badge>
                    <Badge variant="outline">
                      Position: {term.position ?? '-'} / {term.class_size ?? '-'}
                    </Badge>
                  </div>
                </div>
                {term.subjects?.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Subject</th>
                          {customFields.map(f => (
                            <th key={f.id} className="text-center px-3 py-2 font-medium">{f.name}</th>
                          ))}
                          <th className="text-center px-3 py-2 font-medium">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {term.subjects.map((s: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{s.subject_name}</td>
                            {customFields.map(f => (
                              <td key={f.id} className="text-center px-3 py-2">
                                {customScoreFor(term.term_id, s.subject_id, f.id) ?? '-'}
                              </td>
                            ))}
                            <td className="text-center px-3 py-2 font-semibold text-primary">
                              {gradeFor(term.term_id, s.subject_id, s.grade) ?? '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No subject-level scores recorded for this term.
                  </p>
                )}
                <Separator className="mt-6" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

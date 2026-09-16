import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Trophy, Loader2, Users, Lock, Download, MessageSquare, Settings2, CheckCircle2 } from 'lucide-react';
import { useMyReportCard, useStudentReportCard, useCommitTranscripts } from '@/hooks/useResults';
import { useParentChildren } from '@/hooks/useParentChildren';
import { useStudents } from '@/hooks/useStudents';
import { useClassArms } from '@/hooks/useClassArms';
import { useReportCardAccess, useCanDownloadReportCard } from '@/hooks/useAccessRestrictions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { generateReportCardPDF } from '@/lib/pdf';
import { RemarksDialog } from './RemarksDialog';
import {
  useReportCardCustomFields, useReportCardCustomFieldScores,
  useGradeSourceField, useGradeSourceScores, useGradingScales, lookupGrade,
} from '@/hooks/useBroadsheetFields';
import { ManageReportCardVisibilityDialog } from './ManageReportCardVisibilityDialog';
import { toast } from 'sonner';

export function ReportCardView() {
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [commitClassId, setCommitClassId] = useState<string>('');
  const [commitTermId, setCommitTermId] = useState<string>('');
  const { user } = useAuth();
  const { school } = useSchool();
  const isParent = user?.role === 'parent';
  const isStaff = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';
  const canEditPrincipalRemarks = user?.role === 'admin' || user?.role === 'principal';
  const canManageFields = user?.role === 'admin' || user?.role === 'principal';
  const { data: classes = [] } = useClassArms();
  const commitTranscripts = useCommitTranscripts();
  const { isBlocked, isLoading: accessLoading } = useReportCardAccess();
  // Parents/students downloading their OWN report card are never gated by
  // this — it only restricts staff. A non-staff viewer is always allowed
  // through; a staff viewer needs admin/principal or an exempted role.
  const { canDownload: staffCanDownload, isLoading: downloadPermLoading } = useCanDownloadReportCard();
  const canDownload = !isStaff || staffCanDownload;

  const { data: children = [] } = useParentChildren();
  // Staff can view any student in their own school — RLS already scopes
  // this to same_school, this is only about giving them a way to pick one.
  const { data: allStudents = [] } = useStudents();
  const { data: terms = [] } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const { data } = await supabase.from('terms').select('*').order('term_number');
      return data || [];
    }
  });

  // For students, use their own report card
  const { data: myReportCard, isLoading: myLoading } = useMyReportCard(
    !isParent && !isStaff ? selectedTerm : undefined
  );

  // For parents, use selected child's report card. For staff, use whichever
  // student they've picked from the school roster.
  const { data: childReportCard, isLoading: childLoading } = useStudentReportCard(
    isParent ? selectedChildId : isStaff ? selectedStudentId : undefined,
    (isParent || isStaff) ? selectedTerm : undefined
  );

  const reportCard = (isParent || isStaff) ? childReportCard : myReportCard;
  const isLoading = (isParent || isStaff) ? childLoading : myLoading;
  const { data: customFields = [] } = useReportCardCustomFields();
  const { data: customFieldScores = [] } = useReportCardCustomFieldScores(
    reportCard?.student.id,
    reportCard?.term.id,
  );
  const customScoreFor = (subjectId: string, fieldId: string) =>
    customFieldScores.find(s => s.subject_id === subjectId && s.field_id === fieldId)?.score ?? null;

  // Grade badge: prefer the school's designated grade-source Broadsheet
  // field (works for any school, old or new field setup) — falls back to
  // the legacy assessment_scores.grade only when no grade source is set,
  // which is exactly the schools still relying on the old CA1-3/Exam path.
  const { data: gradeSourceField } = useGradeSourceField();
  const { data: gradeSourceScores = [] } = useGradeSourceScores(
    gradeSourceField?.id,
    reportCard?.student.id,
    reportCard?.term.id,
  );
  const { data: gradingScales = [] } = useGradingScales();
  const gradeFor = (subjectId: string, legacyGrade: string | null) => {
    if (gradeSourceField) {
      const score = gradeSourceScores.find(s => s.subject_id === subjectId)?.score ?? null;
      const band = lookupGrade(gradingScales, score);
      return band?.grade ?? null;
    }
    return legacyGrade;
  };

  // Per-subject grade *band* (not just the letter) — needed for its
  // .remark field, which is what the re-added Remarks column below
  // reads. Only available when a grade-source field is set; legacy
  // schools (falling back to assessment_scores.grade in gradeFor above)
  // have no equivalent remark source, so they show '-' for Remarks —
  // nothing in the app has ever written to assessment_scores.remarks.
  const gradeBandFor = (subjectId: string) => {
    if (!gradeSourceField) return null;
    const score = gradeSourceScores.find(s => s.subject_id === subjectId)?.score ?? null;
    return lookupGrade(gradingScales, score);
  };

  // Overall Grade card: looks up the student's overall average against
  // the same grading bands used per-subject — same lookupGrade helper
  // Broadsheet's Final Grade column also uses now.
  const overallGrade = lookupGrade(gradingScales, reportCard?.summary.average_score ?? null);

  const handleDownload = async () => {
    if (!reportCard || !school) return;
    setDownloading(true);
    try {
      await generateReportCardPDF(school, {
        student: {
          first_name: reportCard.student.first_name,
          last_name: reportCard.student.last_name,
          admission_number: reportCard.student.admission_number,
          class_name: reportCard.student.class_name,
          avatar_url: reportCard.student.avatar_url,
        },
        session: reportCard.session,
        term: reportCard.term,
        subjects: reportCard.subjects,
        summary: reportCard.summary,
        attendance: reportCard.attendance,
        behavioral_ratings: reportCard.behavioral_ratings,
        grade_analysis: reportCard.grade_analysis,
        grading_legend: reportCard.grading_legend,
        remarks: reportCard.remarks,
      });
      toast.success('Report card downloaded');
    } catch (err: any) {
      toast.error('Failed to generate report card: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleCommit = async () => {
    try {
      const result = await commitTranscripts.mutateAsync({ classId: commitClassId, termId: commitTermId });
      if (result.committed === 0) {
        toast.info('No active students in that class to commit');
      } else {
        toast.success(`Committed ${result.committed} transcript${result.committed === 1 ? '' : 's'} — total, average, and position all recomputed`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to commit transcripts');
    }
  };

  if (!accessLoading && isBlocked) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium text-foreground">Report cards are currently restricted</p>
          <p className="text-sm mt-1">Please check back later, or contact an Admin/Principal.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {isParent ? "Child's Report Card" : isStaff ? 'Report Card' : 'My Report Card'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {reportCard && isStaff && (
              <Button variant="outline" size="sm" onClick={() => setRemarksOpen(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Edit Remarks
              </Button>
            )}
            {reportCard && !downloadPermLoading && canDownload && (
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading || !school}>
                {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download
              </Button>
            )}
            {canManageFields && (
              <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Manage Fields
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {canManageFields && (
          <div className="mb-6 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <p className="font-medium text-sm">Force-Recompute Transcript</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Transcripts now update automatically whenever a grade-source score changes — you shouldn't
              normally need this. Use it after a bulk data fix (e.g. re-importing old scores) to force a
              full recompute of total, average, and class position for every active student in a class +
              term. Doesn't touch remarks already entered via "Edit Remarks".
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-56">
                <Select value={commitClassId} onValueChange={setCommitClassId}>
                  <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.arm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-56">
                <Select value={commitTermId} onValueChange={setCommitTermId}>
                  <SelectTrigger><SelectValue placeholder="Select Term" /></SelectTrigger>
                  <SelectContent>
                    {terms.map((term: any) => (
                      <SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handleCommit}
                disabled={!commitClassId || !commitTermId || commitTranscripts.isPending}
              >
                {commitTranscripts.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Force Recompute
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-4">
          {/* Parent child switcher */}
          {isParent && (
            <div className="w-64">
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.first_name} {child.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Staff student picker */}
          {isStaff && (
            <div className="w-64">
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Student" />
                </SelectTrigger>
                <SelectContent>
                  {allStudents.map((student: any) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name} — {student.admission_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="w-64">
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger>
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term: any) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isParent && !selectedChildId ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            Select a child to view their report card
          </div>
        ) : isStaff && !selectedStudentId ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            Select a student to view their report card
          </div>
        ) : !selectedTerm ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a term to view the report card
          </div>
        ) : !reportCard ? (
          <div className="text-center py-12 text-muted-foreground">
            No results found for the selected term
          </div>
        ) : (
          <div className="space-y-6">
            {/* Student Info */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarImage src={(reportCard.student as any).avatar_url || undefined} alt={reportCard.student.first_name} />
                <AvatarFallback>{reportCard.student.first_name?.[0]}{reportCard.student.last_name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                <div>
                  <p className="text-sm text-muted-foreground">Student Name</p>
                  <p className="font-medium">{reportCard.student.first_name} {reportCard.student.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Admission No.</p>
                  <p className="font-medium">{reportCard.student.admission_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Class</p>
                  <p className="font-medium">{reportCard.student.class_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Session/Term</p>
                  <p className="font-medium">{reportCard.session.name} - {reportCard.term.name}</p>
                </div>
              </div>
            </div>

            {/* Performance Summary */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Performance Summary</p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{reportCard.subjects.length}</p>
                    <p className="text-sm text-muted-foreground">Subjects</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{reportCard.summary.total_score}</p>
                    <p className="text-sm text-muted-foreground">Total Score</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{reportCard.summary.average_score}</p>
                    <p className="text-sm text-muted-foreground">Average</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{overallGrade?.grade ?? '-'}</p>
                    <p className="text-sm text-muted-foreground">Overall Grade</p>
                    {overallGrade?.remark && (
                      <p className="text-xs text-muted-foreground mt-0.5">{overallGrade.remark}</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {reportCard.summary.position <= 3 && <Trophy className="h-5 w-5 text-yellow-500" />}
                      <p className="text-2xl font-bold">{reportCard.summary.position || '-'}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">Position</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-bold">{reportCard.summary.class_size}</p>
                    <p className="text-sm text-muted-foreground">Class Size</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Attendance */}
            {reportCard.attendance && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-foreground mb-2">Attendance</p>
                {!reportCard.attendance.dates_configured ? (
                  <p className="text-sm text-muted-foreground">
                    This term has no start/end date set — attendance can't be summarized until an
                    admin/principal sets them in Settings → Academic Sessions & Terms.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold">{reportCard.attendance.school_days_opened}</p>
                      <p className="text-xs text-muted-foreground">School Opened</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-success">{reportCard.attendance.times_present}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-destructive">{reportCard.attendance.times_absent}</p>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-accent-foreground">{reportCard.attendance.times_late}</p>
                      <p className="text-xs text-muted-foreground">Late</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-secondary-foreground">{reportCard.attendance.times_excused}</p>
                      <p className="text-xs text-muted-foreground">Excused</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Scores Table — entirely driven by Broadsheet fields toggled
                "show on report card" now (Manage Fields), no more
                hardcoded CA1-3/Exam/Total columns duplicating whatever a
                school set up as its own regular fields. Grade and
                Remarks stay fixed as the last two columns — neither is a
                Broadsheet field, both are derived. Remarks reads the
                grade band's own .remark text (via gradeBandFor above) —
                NOT assessment_scores.remarks, a column nothing in the
                app has ever written to. The Class Teacher's/Principal's
                remarks boxes below (set via "Edit Remarks") are a
                separate, freeform per-term note — this column is the
                per-subject grade-band remark instead. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  {customFields.map(f => (
                    <TableHead key={f.id} className="text-center">{f.name}</TableHead>
                  ))}
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead className="text-center">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportCard.subjects.map((subject, index) => {
                  const grade = gradeFor(subject.subject_id, subject.grade);
                  const band = gradeBandFor(subject.subject_id);
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{subject.subject_name}</TableCell>
                      {customFields.map(f => (
                        <TableCell key={f.id} className="text-center">
                          {customScoreFor(subject.subject_id, f.id) ?? '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Badge variant={
                          grade === 'A' ? 'default' :
                          grade === 'B' ? 'secondary' :
                          grade === 'F' ? 'destructive' : 'outline'
                        }>
                          {grade || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">
                        {band?.remark || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Behavioral domains + Grade analysis/keys — combined into
                one row (each card holding two sub-sections) rather than
                two separate rows, to help keep the whole report card on
                a single printable page. */}
            {(reportCard.behavioral_ratings.affective.length > 0 ||
              reportCard.behavioral_ratings.psychomotor.length > 0 ||
              reportCard.grade_analysis.length > 0 ||
              reportCard.grading_legend.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {(reportCard.behavioral_ratings.affective.length > 0 || reportCard.behavioral_ratings.psychomotor.length > 0) && (
                  <div className="rounded-lg border p-3 space-y-2">
                    {reportCard.behavioral_ratings.affective.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Affective Domain</p>
                        <table className="w-full text-xs">
                          <tbody>
                            {reportCard.behavioral_ratings.affective.map((r, i) => (
                              <tr key={i} className="border-t first:border-t-0">
                                <td className="py-0.5 text-muted-foreground">{r.trait_name}</td>
                                <td className="py-0.5 text-right font-medium w-10">{r.rating}/5</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {reportCard.behavioral_ratings.psychomotor.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1 pt-1 border-t">Psychomotor Domain</p>
                        <table className="w-full text-xs">
                          <tbody>
                            {reportCard.behavioral_ratings.psychomotor.map((r, i) => (
                              <tr key={i} className="border-t first:border-t-0">
                                <td className="py-0.5 text-muted-foreground">{r.trait_name}</td>
                                <td className="py-0.5 text-right font-medium w-10">{r.rating}/5</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                {(reportCard.grade_analysis.length > 0 || reportCard.grading_legend.length > 0) && (
                  <div className="rounded-lg border p-3 space-y-2">
                    {reportCard.grade_analysis.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Grade Analysis</p>
                        <table className="w-full text-xs">
                          <tbody>
                            {reportCard.grade_analysis.map((g, i) => (
                              <tr key={i} className="border-t first:border-t-0">
                                <td className="py-0.5 font-semibold w-8">{g.grade}</td>
                                <td className="py-0.5 text-muted-foreground">{g.remark}</td>
                                <td className="py-0.5 text-right w-8">{g.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {reportCard.grading_legend.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1 pt-1 border-t">Keys to Grades</p>
                        <table className="w-full text-xs">
                          <tbody>
                            {reportCard.grading_legend.map((g, i) => (
                              <tr key={i} className="border-t first:border-t-0">
                                <td className="py-0.5 font-semibold w-8">{g.grade}</td>
                                <td className="py-0.5 text-muted-foreground w-16">{g.min_score}–{g.max_score}</td>
                                <td className="py-0.5 text-right">{g.remark}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Remarks */}
            {!reportCard.remarks.class_teacher && !reportCard.remarks.principal && isStaff && (
              <p className="text-sm text-muted-foreground italic">No remarks added yet — click "Edit Remarks" above to add some.</p>
            )}
            {(reportCard.remarks.class_teacher || reportCard.remarks.principal) && (
              <div className="grid md:grid-cols-2 gap-4">
                {reportCard.remarks.class_teacher && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Class Teacher's Remarks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm italic">{reportCard.remarks.class_teacher}</p>
                    </CardContent>
                  </Card>
                )}
                {reportCard.remarks.principal && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Principal's Remarks</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm italic">{reportCard.remarks.principal}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
      {reportCard && isStaff && (
        <RemarksDialog
          open={remarksOpen}
          onOpenChange={setRemarksOpen}
          reportCard={reportCard}
          canEditPrincipalRemarks={canEditPrincipalRemarks}
        />
      )}
      <ManageReportCardVisibilityDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </Card>
  );
}

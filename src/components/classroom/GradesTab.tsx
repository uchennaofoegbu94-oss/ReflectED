import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface GradesTabProps {
  members: any[];
  assignments: any[];
  classroomId?: string;
}

export function GradesTab({ members, assignments, classroomId }: GradesTabProps) {
  const [activeGradeTab, setActiveGradeTab] = useState<'assignments' | 'quizzes'>('assignments');

  // Get quizzes for this classroom with submissions
  const { data: quizzes = [] } = useQuery({
    queryKey: ['classroom-quizzes-graded', classroomId],
    queryFn: async () => {
      if (!classroomId) return [];
      const { data } = await supabase
        .from('quizzes')
        .select(`
          *,
          quiz_attempts (
            id, student_id, total_score, is_graded, submitted_at
          )
        `)
        .eq('classroom_id', classroomId)
        .eq('is_deleted', false)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!classroomId,
  });

  const publishedAssignments = assignments.filter((a: any) => a.status === 'published');
  const gradedQuizzes = quizzes.filter((q: any) => q.quiz_attempts?.some((a: any) => a.is_graded));

  // Calculate grades for each student
  const getStudentGrades = (sourceTab: 'assignments' | 'quizzes') => {
    const items = sourceTab === 'assignments' ? publishedAssignments : gradedQuizzes;
    
    return members.map((member: any) => {
      const grades: (number | null)[] = [];
      const maxPoints: number[] = [];

      items.forEach((item: any) => {
        const pts = item.points || item.total_marks || item.total_points || 100;
        maxPoints.push(pts);

        if (sourceTab === 'assignments') {
          const submission = item.submissions?.find((s: any) => s.student_id === member.students?.id);
          grades.push(submission?.grade !== undefined && submission?.grade !== null ? submission.grade : null);
        } else {
          const attempt = item.quiz_attempts?.find((a: any) => a.student_id === member.students?.id && a.is_graded);
          grades.push(attempt?.total_score !== undefined ? attempt.total_score : null);
        }
      });

      const validGrades = grades.filter((g): g is number => g !== null);
      const validMaxPts = maxPoints.filter((_, i) => grades[i] !== null);
      const totalEarned = validGrades.reduce((a, b) => a + b, 0);
      const totalMax = validMaxPts.reduce((a, b) => a + b, 0);
      const average = totalMax > 0 ? (totalEarned / totalMax) * 100 : null;

      return { member, grades, maxPoints, average, items };
    });
  };

  const renderGradeTable = (sourceTab: 'assignments' | 'quizzes') => {
    const items = sourceTab === 'assignments' ? publishedAssignments : gradedQuizzes;
    const studentGrades = getStudentGrades(sourceTab);
    const sorted = [...studentGrades].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          {sourceTab === 'assignments' ? (
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          ) : (
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
          )}
          <p className="text-muted-foreground">
            {sourceTab === 'assignments' ? 'No graded assignments yet' : 'No graded quizzes yet'}
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-medium text-muted-foreground sticky left-0 bg-background z-10">Student</th>
              {items.map((item: any) => (
                <th key={item.id} className="text-center py-3 px-4 font-medium text-muted-foreground">
                  <div className="max-w-[120px] truncate">{item.title}</div>
                  <div className="text-xs font-normal">/{item.points || item.total_marks || item.total_points || 100} pts</div>
                </th>
              ))}
              <th className="text-center py-3 px-4 font-medium text-muted-foreground">Average</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ member, grades, maxPoints, average }) => (
              <tr key={member.id} className="border-b border-border/50 hover:bg-muted/50">
                <td className="py-3 px-4 sticky left-0 bg-background z-10">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.students?.avatar_url} />
                      <AvatarFallback>{member.students?.first_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">
                      {member.students?.first_name} {member.students?.last_name}
                    </span>
                  </div>
                </td>
                {grades.map((grade, i) => (
                  <td key={i} className="text-center py-3 px-4">
                    {grade !== null ? (
                      <span className={`font-medium ${
                        (grade / maxPoints[i]) >= 0.7 ? 'text-success' :
                        (grade / maxPoints[i]) >= 0.5 ? 'text-warning' :
                        'text-destructive'
                      }`}>
                        {grade}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
                <td className="text-center py-3 px-4">
                  {average !== null ? (
                    <Badge
                      variant="outline"
                      className={
                        average >= 70 ? 'bg-success/10 text-success border-success/30' :
                        average >= 50 ? 'bg-warning/10 text-warning border-warning/30' :
                        'bg-destructive/10 text-destructive border-destructive/30'
                      }
                    >
                      {average.toFixed(1)}%
                    </Badge>
                  ) : (
                    <Badge variant="outline">—</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (members.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="font-display">Grade Book</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No students enrolled</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Grade Book</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeGradeTab} onValueChange={(v) => setActiveGradeTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="assignments" className="gap-2">
              <FileText size={14} /> Assignments
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="gap-2">
              <ClipboardCheck size={14} /> Quizzes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments">
            {renderGradeTable('assignments')}
          </TabsContent>
          <TabsContent value="quizzes">
            {renderGradeTable('quizzes')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

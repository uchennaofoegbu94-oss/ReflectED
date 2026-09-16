import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Heart, Activity } from 'lucide-react';
import { useClassArms } from '@/hooks/useClassArms';
import { useStudentsForAttendance } from '@/hooks/useAttendance';
import {
  useBehavioralTraits, useClassBehavioralRatings, useSetBehavioralRating,
} from '@/hooks/useBehavioralRatings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function RatingCell({ value, onChange }: { value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-5 w-5 rounded text-[10px] font-medium transition-colors ${
            value === n ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted-foreground/20 text-muted-foreground'
          }`}
          title={`Rate ${n}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function BehaviorRatingsView() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  const { data: classes = [] } = useClassArms();
  const { data: terms = [] } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const { data } = await supabase.from('terms').select('*').order('term_number');
      return data || [];
    },
  });
  const { data: students = [], isLoading: studentsLoading } = useStudentsForAttendance(selectedClass || undefined);
  const { data: traits = [] } = useBehavioralTraits();
  const { data: ratings = [], isLoading: ratingsLoading } = useClassBehavioralRatings(selectedClass, selectedTerm);
  const setRating = useSetBehavioralRating();

  const affectiveTraits = traits.filter(t => t.domain === 'affective');
  const psychomotorTraits = traits.filter(t => t.domain === 'psychomotor');

  const ratingMap = useMemo(() => {
    const map = new Map<string, number>();
    ratings.forEach((r: any) => map.set(`${r.student_id}:${r.trait_id}`, r.rating));
    return map;
  }, [ratings]);

  const handleRate = (studentId: string, traitId: string, rating: number) => {
    if (!selectedTerm) return;
    setRating.mutate({ studentId, termId: selectedTerm, traitId, rating });
  };

  const renderDomainTable = (domainTraits: typeof traits, icon: React.ReactNode, title: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold flex items-center gap-2">{icon} {title}</h4>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/50">Student</th>
              {domainTraits.map(t => (
                <th key={t.id} className="text-center px-2 py-2 font-medium whitespace-nowrap text-xs">{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student: any) => (
              <tr key={student.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-background">
                  {student.first_name} {student.last_name}
                </td>
                {domainTraits.map(t => (
                  <td key={t.id} className="px-2 py-2">
                    <RatingCell
                      value={ratingMap.get(`${student.id}:${t.id}`)}
                      onChange={(v) => handleRate(student.id, t.id, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Behavioral Ratings</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Rate each student 1–5 on affective and psychomotor domains — shown on their report card.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.arm}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Select Term" /></SelectTrigger>
              <SelectContent>
                {terms.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {!selectedClass || !selectedTerm ? (
          <p className="text-center py-12 text-muted-foreground">Select a class and term to begin rating students.</p>
        ) : studentsLoading || ratingsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : students.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">No students in this class.</p>
        ) : (
          <>
            {affectiveTraits.length > 0 && renderDomainTable(affectiveTraits, <Heart className="h-4 w-4" />, 'Affective Domain')}
            {psychomotorTraits.length > 0 && renderDomainTable(psychomotorTraits, <Activity className="h-4 w-4" />, 'Psychomotor Domain')}
          </>
        )}
      </CardContent>
    </Card>
  );
}

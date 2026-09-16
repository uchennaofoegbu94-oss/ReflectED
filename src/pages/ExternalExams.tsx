import { Card, CardContent } from '@/components/ui/card';
import { Award, Clock } from 'lucide-react';

const EXAMS = ['WAEC', 'NECO', 'JAMB', 'IGCSE', 'NABTEB', 'TOEFL'];

export default function ExternalExams() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">External Exam Prep & Certifications</h1>
        <p className="text-muted-foreground mt-1">
          Preparation resources and tracking for external and international exams.
        </p>
      </div>

      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Award className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            This section will bring exam prep materials, mock tests, and registration tracking for
            major external and international exams — right inside the platform.
          </p>
          <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
            {EXAMS.map((exam) => (
              <span key={exam} className="px-3 py-1 rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {exam}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-6">
            <Clock className="h-3.5 w-3.5" />
            In development
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

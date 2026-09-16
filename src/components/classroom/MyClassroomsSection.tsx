import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ArrowRight, Users } from 'lucide-react';
import { useMyClassrooms } from '@/hooks/useClassroomData';
import { JoinClassroomDialog } from '@/components/classroom/JoinClassroomDialog';
import { CreateClassroomDialog } from '@/components/classroom/CreateClassroomDialog';

interface MyClassroomsSectionProps {
  isTeacher: boolean;
  limit?: number;
}

export function MyClassroomsSection({ isTeacher, limit = 4 }: MyClassroomsSectionProps) {
  const { data: classrooms = [], isLoading } = useMyClassrooms();

  const displayedClassrooms = classrooms.slice(0, limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">My Classrooms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="font-display">My Classrooms</CardTitle>
        <div className="flex gap-2">
          {isTeacher ? (
            <CreateClassroomDialog />
          ) : (
            <JoinClassroomDialog />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {classrooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              {isTeacher ? 'Create your first classroom' : 'Join a classroom to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              {displayedClassrooms.map((classroom: any) => (
                <Link key={classroom.id} to={`/classroom?id=${classroom.id}`} className="block">
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:border-secondary hover:shadow-md">
                    <div 
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: classroom.banner_color || '#0B1F3B' }}
                    >
                      <BookOpen size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{classroom.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {classroom.subjects?.name || classroom.class_arms?.name || 'General'}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {classroom.code}
                    </Badge>
                    <ArrowRight size={16} className="text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
            {classrooms.length > limit && (
              <Link to="/classroom" className="block mt-4">
                <Button variant="ghost" className="w-full text-secondary">
                  View All ({classrooms.length} classrooms)
                </Button>
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

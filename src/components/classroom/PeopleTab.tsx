import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';

interface PeopleTabProps {
  user: any;
  members: any[];
}

export function PeopleTab({ user, members }: PeopleTabProps) {
  return (
    <div className="space-y-6">
      {/* Teachers */}
      <div>
        <h3 className="text-lg font-semibold font-display mb-4">Teachers</h3>
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border">
          <Avatar className="h-12 w-12 avatar-ring">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback>{user?.name?.charAt(0) || 'T'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{user?.name || 'Teacher'}</p>
            <p className="text-sm text-muted-foreground">Class Teacher</p>
          </div>
        </div>
      </div>

      {/* Students */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold font-display">Students</h3>
          <span className="text-sm text-muted-foreground">{members.length} students</span>
        </div>
        {members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No students enrolled yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {members.map((member: any) => (
              <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.students?.avatar_url} />
                  <AvatarFallback>
                    {member.students?.first_name?.charAt(0)}{member.students?.last_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">
                    {member.students?.first_name} {member.students?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.students?.admission_number}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

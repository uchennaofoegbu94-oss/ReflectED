import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserCheck, UserX, Clock } from 'lucide-react';
import { usePendingSignups, useReviewSignup } from '@/hooks/usePendingSignups';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrator',
  principal: 'Principal',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent/Guardian',
  accountant: 'Accountant',
};

// #4: a pending self-signup, with the ability to change its account type
// before approving — e.g. someone who picked "Principal" by mistake gets
// reassigned to "Teacher" and approved in the same action.
export function PendingApprovalsCard() {
  const { data: pending = [], isLoading } = usePendingSignups();
  const reviewSignup = useReviewSignup();
  const [roleOverrides, setRoleOverrides] = useState<Record<string, AppRole>>({});

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-secondary" />
          <CardTitle className="text-lg">Pending Approvals</CardTitle>
          {pending.length > 0 && <Badge variant="secondary">{pending.length}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          New self-signups wait here until approved. You can change the account type before approving.
        </p>
      </CardHeader>
      <CardContent>
        {pending.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground text-sm">No signups waiting for review</p>
        ) : (
          <div className="space-y-3">
            {pending.map((signup) => {
              const selectedRole = roleOverrides[signup.user_id] || signup.role;
              const roleChanged = selectedRole !== signup.role;
              return (
                <div key={signup.user_id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{signup.profile?.full_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground truncate">{signup.profile?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Signed up as</span>
                    <Select
                      value={selectedRole}
                      onValueChange={(v) => setRoleOverrides(prev => ({ ...prev, [signup.user_id]: v as AppRole }))}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(roleLabels) as AppRole[]).map((r) => (
                          <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => reviewSignup.mutate({
                        userId: signup.user_id,
                        decision: 'approve',
                        newRole: roleChanged ? selectedRole : undefined,
                      })}
                      disabled={reviewSignup.isPending}
                    >
                      <UserCheck className="h-4 w-4" /> {roleChanged ? `Approve as ${roleLabels[selectedRole]}` : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Reject this signup for ${signup.profile?.full_name || 'this account'}?`)) {
                          reviewSignup.mutate({ userId: signup.user_id, decision: 'reject' });
                        }
                      }}
                      disabled={reviewSignup.isPending}
                    >
                      <UserX className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AwaitingApprovalProps {
  status?: 'pending' | 'rejected';
}

export default function AwaitingApproval({ status = 'pending' }: AwaitingApprovalProps) {
  const { user, logout } = useAuth();
  const isRejected = status === 'rejected';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--gradient-hero)' }}>
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-2 h-12 w-12 rounded-full flex items-center justify-center ${isRejected ? 'bg-destructive/10' : 'bg-secondary/10'}`}>
            {isRejected ? <XCircle className="h-6 w-6 text-destructive" /> : <Clock className="h-6 w-6 text-secondary" />}
          </div>
          <CardTitle>{isRejected ? 'Account Not Approved' : 'Awaiting Approval'}</CardTitle>
          <CardDescription>
            {isRejected ? (
              "This account's signup wasn't approved. Contact your school admin or principal if you believe this is a mistake."
            ) : (
              <>
                {user?.name ? `Hi ${user.name}, your` : 'Your'} account has been created but still needs
                to be reviewed before you can sign in. A school admin, principal, or super-admin will
                approve your account type shortly.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

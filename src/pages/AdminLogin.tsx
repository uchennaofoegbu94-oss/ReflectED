import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Lock, ArrowRight, Shield, Home, Eye, EyeOff, AlertOctagon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const { data: platformSettings } = usePlatformSettings();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await login(email, password);
    if (error) {
      setIsLoading(false);
      toast.error(error);
      return;
    }
    // Verify the signed-in user is actually a platform super admin
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setIsLoading(false);
      toast.error('Authentication failed');
      return;
    }
    const { data: sa } = await supabase
      .from('super_admins' as any)
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();
    setIsLoading(false);
    if (!sa) {
      await logout();
      toast.error('This account is not a platform administrator. Use the school login instead.');
      return;
    }
    toast.success('Welcome, Administrator');
    navigate('/super-admin');
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Enter your email above first');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success('Password reset email sent. Check your inbox.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--gradient-hero)' }}>
      {platformSettings?.maintenance_mode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 text-center">
          <AlertOctagon size={16} className="shrink-0" />
          {platformSettings.maintenance_message || 'ReflectED is undergoing scheduled maintenance. You may experience brief interruptions.'}
        </div>
      )}
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-display">Platform Admin</CardTitle>
          <CardDescription>Sign in to the ReflectED super admin panel</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@reflected.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full btn-primary gap-2" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In as Admin'}
              <ArrowRight size={18} />
            </Button>
          </form>
          <div className="mt-6 text-center space-y-2">
            <button type="button" onClick={handleForgotPassword} className="block w-full text-sm text-secondary hover:underline">
              Forgot password?
            </button>
            <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to school login
            </Link>
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Home size={14} />Back to Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

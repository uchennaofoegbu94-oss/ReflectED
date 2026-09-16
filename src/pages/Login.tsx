import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Lock, ArrowRight, User, School, Home, Eye, EyeOff, AlertOctagon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

type AppRole = Database['public']['Enums']['app_role'];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('student');
  const [schoolCode, setSchoolCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const { data: platformSettings } = usePlatformSettings();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await login(email, password);
    setIsLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!schoolCode.trim()) {
      toast.error('Please enter a school code');
      return;
    }

    setIsLoading(true);

    // Resolve school code to school ID
    const { data: schoolData, error: schoolError } = await supabase
      .rpc('find_school_by_code', { _code: schoolCode.trim() });

    if (schoolError || !schoolData || schoolData.length === 0) {
      setIsLoading(false);
      toast.error('Invalid school code. Please check and try again.');
      return;
    }

    const schoolId = schoolData[0].id;

    const { error } = await signup(email, password, fullName, role, schoolId);
    setIsLoading(false);

    if (error) {
      if (error.includes('already registered')) {
        toast.error('This email is already registered. Please login instead.');
      } else {
        toast.error(error);
      }
    } else {
      toast.success('Account created successfully!');
      navigate('/dashboard');
    }
  };

  const roleOptions: { value: AppRole; label: string }[] = [
    { value: 'admin', label: 'Administrator' },
    { value: 'principal', label: 'Principal' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'student', label: 'Student' },
    { value: 'parent', label: 'Parent/Guardian' },
    { value: 'accountant', label: 'Accountant' },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--gradient-hero)' }}>
      {platformSettings?.maintenance_mode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 text-center">
          <AlertOctagon size={16} className="shrink-0" />
          {platformSettings.maintenance_message || 'ReflectED is undergoing scheduled maintenance. You may experience brief interruptions.'}
        </div>
      )}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 text-white">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
              <span className="font-display text-2xl font-bold text-accent-foreground">R</span>
            </div>
            <div>
              <span className="font-display text-3xl font-bold">Reflect<span className="text-accent">ED</span></span>
              <p className="text-sm text-white/60 uppercase tracking-wider">School Management System</p>
            </div>
          </div>
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-6 text-sm">
            <Home size={16} />Back to Home
          </Link>
          <h1 className="text-4xl font-bold font-display mb-4">A Reflection of Excellence</h1>
          <p className="text-lg text-white/80 mb-8">
            Modern school management and learning system built for Nigerian schools.
            One platform for attendance, grades, assignments, and communication.
          </p>
          <div className="flex flex-wrap gap-3">
            {['Attendance', 'Grades', 'Assignments', 'Fees', 'Communication'].map((feature) => (
              <span key={feature} className="px-3 py-1 rounded-full bg-white/10 text-sm">{feature}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <span className="font-display text-lg font-bold text-primary-foreground">R</span>
              </div>
              <span className="font-display text-xl font-bold text-foreground">Reflect<span className="text-secondary">ED</span></span>
            </div>
            <CardTitle className="text-2xl font-display">Welcome</CardTitle>
            <CardDescription>Sign in or create an account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup" disabled={platformSettings?.self_service_signup_enabled === false}>Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="login-password" type={showLoginPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) { toast.error('Enter your email above first'); return; }
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        if (error) toast.error(error.message);
                        else toast.success('Password reset email sent. Check your inbox.');
                      }}
                      className="text-xs text-secondary hover:underline ml-auto block"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className="w-full btn-primary gap-2" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                    <ArrowRight size={18} />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {platformSettings?.self_service_signup_enabled === false ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p>Self-service sign up is currently turned off.</p>
                    <p className="mt-1">Ask your school's admin to add you directly instead.</p>
                  </div>
                ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="signup-name" type="text" placeholder="Enter your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="signup-email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="signup-password" type={showSignupPassword ? 'text' : 'password'} placeholder="Create a password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required minLength={6} />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-school-code">School Code</Label>
                    <div className="relative">
                      <School className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-school-code"
                        type="text"
                        placeholder="Enter your school code"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                        className="pl-10 uppercase"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Ask your school administrator for the school code</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Role</Label>
                    <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full btn-primary gap-2" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create Account'}
                    <ArrowRight size={18} />
                  </Button>
                </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

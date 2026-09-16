import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Mail, Lock, User, ArrowRight, GraduationCap, ClipboardCheck, CreditCard, BarChart3, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const dashboardRoute = user?.isSuperAdmin ? '/super-admin' : '/dashboard';
  const [registerOpen, setRegisterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    school_name: '',
    school_code: '',
    school_email: '',
    school_address: '',
    school_phone: '',
    admin_email: '',
    admin_password: '',
    admin_full_name: '',
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.school_name.trim() || !form.school_code.trim()) {
      toast.error('School name and code are required');
      return;
    }
    if (!form.admin_email || !form.admin_password || !form.admin_full_name) {
      toast.error('Admin details are required');
      return;
    }
    if (form.admin_password.length < 6) {
      toast.error('Admin password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-school-with-admin', {
        body: form,
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setIsLoading(false);
        return;
      }

      toast.success(`School "${form.school_name}" created! The admin can now sign in.`);
      setRegisterOpen(false);
      setForm({
        school_name: '', school_code: '', school_email: '', school_address: '',
        school_phone: '', admin_email: '', admin_password: '', admin_full_name: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to register school');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: GraduationCap, title: 'Classroom Management', desc: 'Virtual classrooms, assignments, quizzes, and materials all in one place.' },
    { icon: ClipboardCheck, title: 'Attendance & Results', desc: 'QR attendance, broadsheets, report cards, and academic tracking.' },
    { icon: CreditCard, title: 'Financial Management', desc: 'Fee structures, payment tracking, expenses, and financial reports.' },
    { icon: BarChart3, title: 'Analytics & Insights', desc: 'Comprehensive dashboards and analytics for data-driven decisions.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent">
                <span className="font-display text-xl font-bold text-accent-foreground">R</span>
              </div>
              <div>
                <span className="font-display text-2xl font-bold text-white">Reflect<span className="text-accent">ED</span></span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Button
                  onClick={() => navigate(dashboardRoute)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                >
                  <LayoutDashboard size={18} />
                  Dashboard
                </Button>
              ) : (
                <>
                  <Link to="/login">
                    <Button className="bg-white text-primary hover:bg-white shadow-md gap-2 font-semibold">
                      Sign In
                      <ArrowRight size={16} />
                    </Button>
                  </Link>
                  <Link to="/admin-login">
                    <Button variant="ghost" className="text-white hover:text-white hover:bg-white/15 text-sm font-medium">
                      Admin
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="max-w-2xl">
            <h1 className="text-4xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
              A Reflection of <span className="text-accent">Excellence</span>
            </h1>
            <p className="text-lg lg:text-xl text-white/80 mb-8 leading-relaxed">
              The modern school management platform built for Nigerian schools.
              Manage attendance, grades, fees, communication, and more — all in one place.
            </p>
            <div className="flex flex-wrap gap-4">
              {isAuthenticated ? (
                <Button
                  size="lg"
                  onClick={() => navigate(dashboardRoute)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-base px-8"
                >
                  <LayoutDashboard size={20} />
                  Go to Dashboard
                  <ArrowRight size={18} />
                </Button>
              ) : (
                <>
                  <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
                    <DialogTrigger asChild>
                      <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2 text-base px-8">
                        <Building2 size={20} />
                        Register Your School
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="font-display text-xl">Register Your School</DialogTitle>
                        <p className="text-sm text-muted-foreground">Set up your school and admin account in one step</p>
                      </DialogHeader>
                      <form onSubmit={handleRegister} className="space-y-5 mt-4">
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">School Details</h3>
                          <div className="space-y-2">
                            <Label>School Name *</Label>
                            <Input placeholder="e.g. Springfield Academy" value={form.school_name} onChange={(e) => setForm(f => ({ ...f, school_name: e.target.value }))} required />
                          </div>
                          <div className="space-y-2">
                            <Label>School Code *</Label>
                            <Input placeholder="e.g. SPRINGFIELD" value={form.school_code} onChange={(e) => setForm(f => ({ ...f, school_code: e.target.value.toUpperCase().replace(/\s/g, '') }))} className="uppercase" required />
                            <p className="text-xs text-muted-foreground">Unique code your staff and students will use to join</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>School Email</Label>
                              <Input type="email" placeholder="info@school.com" value={form.school_email} onChange={(e) => setForm(f => ({ ...f, school_email: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Phone</Label>
                              <Input placeholder="08012345678" value={form.school_phone} onChange={(e) => setForm(f => ({ ...f, school_phone: e.target.value }))} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Address</Label>
                            <Input placeholder="School address" value={form.school_address} onChange={(e) => setForm(f => ({ ...f, school_address: e.target.value }))} />
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-3">
                          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Admin Account</h3>
                          <div className="space-y-2">
                            <Label>Admin Full Name *</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input placeholder="Admin's full name" value={form.admin_full_name} onChange={(e) => setForm(f => ({ ...f, admin_full_name: e.target.value }))} className="pl-10" required />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Admin Email *</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="email" placeholder="admin@school.com" value={form.admin_email} onChange={(e) => setForm(f => ({ ...f, admin_email: e.target.value }))} className="pl-10" required />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Admin Password *</Label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input type="password" placeholder="Min 6 characters" value={form.admin_password} onChange={(e) => setForm(f => ({ ...f, admin_password: e.target.value }))} className="pl-10" required minLength={6} />
                            </div>
                          </div>
                        </div>

                        <Button type="submit" className="w-full btn-primary gap-2" disabled={isLoading}>
                          {isLoading ? 'Creating School...' : 'Create School & Admin'}
                          <ArrowRight size={18} />
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Link to="/login">
                    <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur border-2 border-white text-white hover:bg-white hover:text-primary gap-2 text-base px-8 font-semibold">
                      Sign In
                      <ArrowRight size={18} />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-display font-bold text-foreground mb-4">
            Everything Your School Needs
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From classroom management to financial tracking, ReflectED provides a complete suite of tools.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="border hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-muted/30 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-display font-bold text-foreground mb-10 text-center">Get Started in 3 Steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Register Your School', desc: 'Fill in your school details and create the first admin account.' },
              { step: '2', title: 'Share Your School Code', desc: 'Teachers, students, and parents sign up using your unique school code.' },
              { step: '3', title: 'Start Managing', desc: 'Set up classes, subjects, timetables, and start tracking everything.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground font-display font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-foreground">Reflect<span className="text-secondary">ED</span></span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          {isAuthenticated ? (
            <button onClick={() => navigate(dashboardRoute)} className="hover:text-foreground transition-colors">
              Dashboard
            </button>
          ) : (
            <Link to="/admin-login" className="hover:text-foreground transition-colors">
              Platform Admin
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CreditCard, Search } from 'lucide-react';

interface SchoolSubscriptionRow {
  id: string;
  school_id: string;
  tier: 'trial' | 'basic' | 'pro' | 'enterprise';
  status: 'trialing' | 'active' | 'past_due' | 'cancelled';
  trial_ends_at: string | null;
  schools: { name: string; school_code: string; is_active: boolean } | null;
}

const TIER_LABELS: Record<string, string> = { trial: 'Trial', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
const STATUS_COLORS: Record<string, string> = {
  trialing: 'bg-blue-500/10 text-blue-600 border-blue-300',
  active: 'bg-green-500/10 text-green-600 border-green-300',
  past_due: 'bg-amber-500/10 text-amber-600 border-amber-300',
  cancelled: 'bg-red-500/10 text-red-600 border-red-300',
};

// Deliberately a tier/status SWITCHBOARD, not a billing engine — there's
// no pricing-tier or payment-processing system yet (flagged explicitly
// by the user as "soon"). This tracks and lets a super admin manually set
// which tier/status each school is on, which is useful immediately and
// is what the future pricing/payment system will plug into, rather than
// building throwaway speculative billing logic ahead of that system
// actually existing.
export default function SuperAdminBilling() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['school-subscriptions'],
    queryFn: async (): Promise<SchoolSubscriptionRow[]> => {
      const { data, error } = await supabase
        .from('school_subscriptions' as any)
        .select('id, school_id, tier, status, trial_ends_at, schools (name, school_code, is_active)')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!user?.isSuperAdmin,
  });

  const updateSubscription = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; tier?: string; status?: string }) => {
      const { error } = await supabase
        .from('school_subscriptions' as any)
        .update({ ...updates, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
      toast.success('Subscription updated');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update'),
  });

  const filtered = subscriptions.filter((s) =>
    s.schools?.name.toLowerCase().includes(search.toLowerCase()) ||
    s.schools?.school_code.toLowerCase().includes(search.toLowerCase())
  );

  const tierCounts = subscriptions.reduce((acc: Record<string, number>, s) => {
    acc[s.tier] = (acc[s.tier] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Billing & Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Manual tier and status tracking for now — real pricing/payment processing lands once the
          pricing-tier system ships.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['trial', 'basic', 'pro', 'enterprise'] as const).map((tier) => (
          <Card key={tier}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xl font-bold">{tierCounts[tier] || 0}</p>
                  <p className="text-xs text-muted-foreground">{TIER_LABELS[tier]}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search schools..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Schools</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">School</th>
                    <th className="pb-2 font-medium text-center">Tier</th>
                    <th className="pb-2 font-medium text-center">Status</th>
                    <th className="pb-2 font-medium text-center">Trial Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sub) => (
                    <tr key={sub.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">
                        {sub.schools?.name}
                        <span className="block text-xs text-muted-foreground font-mono">{sub.schools?.school_code}</span>
                      </td>
                      <td className="py-3 text-center">
                        <Select value={sub.tier} onValueChange={(v) => updateSubscription.mutate({ id: sub.id, tier: v })}>
                          <SelectTrigger className="w-[130px] mx-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIER_LABELS).map(([v, label]) => (
                              <SelectItem key={v} value={v}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 text-center">
                        <Select value={sub.status} onValueChange={(v) => updateSubscription.mutate({ id: sub.id, status: v })}>
                          <SelectTrigger className="w-[130px] mx-auto">
                            <SelectValue>
                              <Badge variant="outline" className={STATUS_COLORS[sub.status]}>{sub.status.replace('_', ' ')}</Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trialing">Trialing</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="past_due">Past Due</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3 text-center text-muted-foreground">
                        {sub.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">No schools match</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

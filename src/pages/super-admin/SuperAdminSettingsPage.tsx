import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertOctagon, Users, Save } from 'lucide-react';

interface PlatformSettings {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  self_service_signup_enabled: boolean;
}

// The "no control switches anywhere" gap, directly addressed — a real
// platform_settings row (singleton, see the billing_and_platform_settings
// migration) instead of nothing at all. Maintenance mode here is
// deliberately a BANNER + flag for the login/signup pages to read, not a
// hard outage switch that could lock out every school at once from one
// checkbox — that's a safer default for a first version of this control.
export default function SuperAdminSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [selfServiceEnabled, setSelfServiceEnabled] = useState(true);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async (): Promise<PlatformSettings> => {
      const { data, error } = await supabase
        .from('platform_settings' as any)
        .select('maintenance_mode, maintenance_message, self_service_signup_enabled')
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.isSuperAdmin,
  });

  useEffect(() => {
    if (settings) {
      setMaintenanceMode(settings.maintenance_mode);
      setMaintenanceMessage(settings.maintenance_message || '');
      setSelfServiceEnabled(settings.self_service_signup_enabled);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('platform_settings' as any)
        .update({
          maintenance_mode: maintenanceMode,
          maintenance_message: maintenanceMessage || null,
          self_service_signup_enabled: selfServiceEnabled,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success('Platform settings saved');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to save settings'),
  });

  const hasChanges = settings && (
    maintenanceMode !== settings.maintenance_mode ||
    maintenanceMessage !== (settings.maintenance_message || '') ||
    selfServiceEnabled !== settings.self_service_signup_enabled
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Platform-wide switches — these apply to every school</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertOctagon className="h-5 w-5 text-amber-600" />
            Maintenance Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Show maintenance banner</p>
              <p className="text-sm text-muted-foreground">
                Displays a banner to everyone platform-wide. Does not lock anyone out — it's a heads-up, not an outage switch.
              </p>
            </div>
            <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
          </div>
          {maintenanceMode && (
            <div>
              <Label>Banner message</Label>
              <Textarea
                placeholder="e.g. Scheduled maintenance tonight 11PM-1AM WAT — you may see brief interruptions."
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Self-Service Signup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Allow new self-service school signups</p>
              <p className="text-sm text-muted-foreground">
                When off, new schools can only be created here (Schools → Create School) — the public signup flow is hidden.
              </p>
            </div>
            <Switch checked={selfServiceEnabled} onCheckedChange={setSelfServiceEnabled} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => saveSettings.mutate()} disabled={!hasChanges || saveSettings.isPending} className="gap-2">
        <Save size={16} />
        {saveSettings.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}

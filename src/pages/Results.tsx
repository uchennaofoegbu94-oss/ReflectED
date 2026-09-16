import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { BroadsheetView } from '@/components/results/BroadsheetView';
import { BehaviorRatingsView } from '@/components/results/BehaviorRatingsView';
import { ReportCardView } from '@/components/results/ReportCardView';
import { TranscriptView } from '@/components/results/TranscriptView';
import { PreCAView } from '@/components/results/PreCAView';
import { useResultsStats } from '@/hooks/useResultsStats';
import { useReportCardAccess, useTranscriptAccess } from '@/hooks/useAccessRestrictions';
import {
  FileText,
  Users,
  Download,
  TrendingUp,
  Layers,
  Heart,
} from 'lucide-react';

export default function Results() {
  const { user } = useAuth();
  const isStaff = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const { data: stats } = useResultsStats();
  // Hides the tab trigger for restricted teachers, matching the existing
  // proctor-mode convention (hide, don't dead-end) — ReportCardView/
  // TranscriptView still enforce the block internally regardless.
  const { isBlocked: reportCardsBlocked } = useReportCardAccess();
  const { isBlocked: transcriptsBlocked } = useTranscriptAccess();

  const [activeTab, setActiveTab] = useState(isStaff ? 'broadsheet' : 'report-card');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">
            {isStaff ? 'Results Management' : 'My Results'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isStaff 
              ? 'View and manage student academic results and transcripts'
              : 'View your academic performance and report cards'
            }
          </p>
        </div>
      </div>

      {/* Stats for Staff */}
      {isStaff && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-xl bg-secondary/10 p-3 text-secondary">
                <Users size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.studentCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">Students</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-xl bg-success/10 p-3 text-success">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.resultsEnteredCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">Results Entered</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-xl bg-warning/10 p-3 text-warning">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.classAverage ?? 0}%</p>
                <p className="text-sm text-muted-foreground">Class Average</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="rounded-xl bg-accent/20 p-3 text-accent-foreground">
                <Download size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.downloadCount ?? 0}</p>
                <p className="text-sm text-muted-foreground">Downloads</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content based on role */}
      {isStaff ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 gap-0">
            <TabsTrigger value="preca" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-4 py-3 gap-2">
              <Layers size={16} />
              Pre-CA
            </TabsTrigger>
            <TabsTrigger value="broadsheet" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-4 py-3 gap-2">
              <FileText size={16} />
              Broadsheet
            </TabsTrigger>
            <TabsTrigger value="behavior" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-4 py-3 gap-2">
              <Heart size={16} />
              Behavior
            </TabsTrigger>
            {!reportCardsBlocked && (
              <TabsTrigger value="report-card" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-4 py-3 gap-2">
                <Users size={16} />
                Report Cards
              </TabsTrigger>
            )}
            {!transcriptsBlocked && (
              <TabsTrigger value="transcripts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-secondary data-[state=active]:bg-transparent px-4 py-3 gap-2">
                <Download size={16} />
                Transcripts
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="preca" className="mt-6">
            <PreCAView />
          </TabsContent>

          <TabsContent value="broadsheet" className="mt-6">
            <BroadsheetView />
          </TabsContent>

          <TabsContent value="behavior" className="mt-6">
            <BehaviorRatingsView />
          </TabsContent>

          <TabsContent value="report-card" className="mt-6">
            <ReportCardView />
          </TabsContent>

          <TabsContent value="transcripts" className="mt-6">
            <TranscriptView />
          </TabsContent>
        </Tabs>
      ) : (
        // Student or Parent view
        <ReportCardView />
      )}
    </div>
  );
}

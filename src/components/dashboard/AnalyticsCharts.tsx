import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#00C49F', '#FFBB28'];

interface PerformanceData {
  name: string;
  average: number;
  students: number;
}

interface CompletionData {
  name: string;
  value: number;
}

interface TrendData {
  month: string;
  attendance: number;
  performance: number;
}

// Mock data - in production, this would come from the database
const performanceBySubject: PerformanceData[] = [
  { name: 'Mathematics', average: 72, students: 45 },
  { name: 'English', average: 78, students: 45 },
  { name: 'Science', average: 68, students: 45 },
  { name: 'Social Studies', average: 75, students: 45 },
  { name: 'Computer', average: 82, students: 45 },
];

const assignmentCompletion: CompletionData[] = [
  { name: 'Completed', value: 68 },
  { name: 'Pending', value: 22 },
  { name: 'Overdue', value: 10 },
];

const monthlyTrends: TrendData[] = [
  { month: 'Sep', attendance: 92, performance: 70 },
  { month: 'Oct', attendance: 88, performance: 72 },
  { month: 'Nov', attendance: 90, performance: 75 },
  { month: 'Dec', attendance: 85, performance: 71 },
  { month: 'Jan', attendance: 91, performance: 78 },
];

const gradeDistribution: CompletionData[] = [
  { name: 'A (70-100)', value: 25 },
  { name: 'B (60-69)', value: 35 },
  { name: 'C (50-59)', value: 25 },
  { name: 'D (40-49)', value: 10 },
  { name: 'F (0-39)', value: 5 },
];

export function AnalyticsCharts() {
  const { user } = useAuth();
  const { data: stats } = useDashboardStats();

  const isStaff = user?.role === 'admin' || user?.role === 'principal' || user?.role === 'teacher';

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Performance by Subject */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Average Performance by Subject</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceBySubject}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))' 
                }} 
              />
              <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Assignment Completion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignment Completion Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={assignmentCompletion}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {assignmentCompletion.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Grade Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grade Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={gradeDistribution}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {gradeDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Monthly Attendance & Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))' 
                }} 
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="attendance" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
              <Line 
                type="monotone" 
                dataKey="performance" 
                stroke="hsl(var(--secondary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--secondary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Stats for Staff */}
      {isStaff && stats && (
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Quick Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.totalTeachers}</p>
                <p className="text-sm text-muted-foreground">Total Teachers</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.attendanceRate}%</p>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats.newStudentsThisMonth}</p>
                <p className="text-sm text-muted-foreground">New Enrollments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

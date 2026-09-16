import { useState } from 'react';
import { ViewToggle, type ViewMode } from '@/components/shared/ViewToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useClassArms, useDeleteClassArm } from '@/hooks/useClassArms';
import { useStudents } from '@/hooks/useStudents';
import { useStaff } from '@/hooks/useStaff';
import { useSubjects, useClassSubjects } from '@/hooks/useSubjects';
import { AddClassDialog } from '@/components/principal/AddClassDialog';
import { AssignStudentToClassDialog } from '@/components/principal/AssignStudentToClassDialog';
import { AssignSubjectDialog } from '@/components/principal/AssignSubjectDialog';
import { EditClassDialog } from '@/components/principal/EditClassDialog';
import { ClassSubjectsDialog } from '@/components/principal/ClassSubjectsDialog';
import {
  Search,
  Plus,
  Users,
  GraduationCap,
  BookOpen,
  Loader2,
  MoreVertical,
  UserPlus,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type ClassArm = Database['public']['Tables']['class_arms']['Row'];

const levelColors: Record<string, string> = {
  primary: 'bg-success/10 text-success border-success/20',
  junior_secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  senior_secondary: 'bg-primary/10 text-primary border-primary/20',
};

export default function Classes() {
  const { user } = useAuth();
  const { data: classArms = [], isLoading } = useClassArms();
  const deleteClassArm = useDeleteClassArm();
  const { data: students = [] } = useStudents();
  const { data: staff = [] } = useStaff();
  const { data: subjects = [] } = useSubjects();
  const { data: classSubjects = [] } = useClassSubjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [levelFilter, setLevelFilter] = useState('all');
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [assignStudentOpen, setAssignStudentOpen] = useState(false);
  const [assignSubjectOpen, setAssignSubjectOpen] = useState(false);
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewSubjectsOpen, setViewSubjectsOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedClassArm, setSelectedClassArm] = useState<ClassArm | null>(null);

  const filteredClasses = classArms.filter((cls) => {
    const displayName = `${cls.name} ${cls.arm}`.toLowerCase();
    const matchesSearch = displayName.includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || cls.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  const getClassStudentCount = (classId: string) => {
    return students.filter(s => s.class_id === classId).length;
  };

  const getClassSubjectCount = (classId: string) => {
    return classSubjects.filter(cs => cs.class_id === classId).length;
  };

  const getClassTeacher = (classId: string) => {
    const cls = classArms.find(c => c.id === classId);
    if (!cls?.class_teacher_id) return null;
    return staff.find(s => s.id === cls.class_teacher_id);
  };

  const stats = {
    total: classArms.length,
    primary: classArms.filter(c => c.level === 'primary').length,
    juniorSecondary: classArms.filter(c => c.level === 'junior_secondary').length,
    seniorSecondary: classArms.filter(c => c.level === 'senior_secondary').length,
  };

  const handleAssignStudent = (classId: string) => {
    setSelectedClassId(classId);
    setAssignStudentOpen(true);
  };

  const handleAssignSubject = (classId: string) => {
    setSelectedClassId(classId);
    setAssignSubjectOpen(true);
  };

  const handleViewSubjects = (cls: ClassArm) => {
    setSelectedClassId(cls.id);
    setSelectedClassName(`${cls.name} ${cls.arm}`);
    setViewSubjectsOpen(true);
  };

  const handleEditClass = (classArm: ClassArm) => {
    setSelectedClassArm(classArm);
    setEditClassOpen(true);
  };

  const handleDeleteClass = (classArm: ClassArm) => {
    setSelectedClassArm(classArm);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteClass = async () => {
    if (!selectedClassArm) return;
    
    try {
      await deleteClassArm.mutateAsync(selectedClassArm.id);
      toast.success('Class deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedClassArm(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete class');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">Classes</h1>
          <p className="text-muted-foreground mt-1">
            Manage class arms, students, and subjects
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <Button className="btn-accent gap-2" onClick={() => setAddClassOpen(true)}>
              <Plus size={18} />
              Create Class
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Classes</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Primary</p>
            <p className="text-2xl font-bold text-success mt-1">{stats.primary}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Junior Secondary</p>
            <p className="text-2xl font-bold text-secondary mt-1">{stats.juniorSecondary}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Senior Secondary</p>
            <p className="text-2xl font-bold text-primary mt-1">{stats.seniorSecondary}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="junior_secondary">Junior Secondary</SelectItem>
                <SelectItem value="senior_secondary">Senior Secondary</SelectItem>
              </SelectContent>
            </Select>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </CardContent>
      </Card>

      {/* Classes Grid */}
      {viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-4 px-4 font-medium text-muted-foreground">Class</th>
                    <th className="text-left py-4 px-4 font-medium text-muted-foreground">Level</th>
                    <th className="text-left py-4 px-4 font-medium text-muted-foreground">Class Teacher</th>
                    <th className="text-left py-4 px-4 font-medium text-muted-foreground">Students</th>
                    <th className="text-left py-4 px-4 font-medium text-muted-foreground">Subjects</th>
                    {isAdmin && <th className="text-right py-4 px-4 font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-muted-foreground">
                        {searchQuery || levelFilter !== 'all'
                          ? 'No classes match your filters'
                          : 'No classes found. Create your first class!'}
                      </td>
                    </tr>
                  ) : (
                    filteredClasses.map((cls) => {
                      const classTeacher = getClassTeacher(cls.id);
                      return (
                        <tr key={cls.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium text-foreground">{cls.name} {cls.arm}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={levelColors[cls.level]}>
                              {cls.level.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {classTeacher ? `${classTeacher.first_name} ${classTeacher.last_name}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-sm text-foreground">{getClassStudentCount(cls.id)}</td>
                          <td className="py-3 px-4 text-sm text-foreground">{getClassSubjectCount(cls.id)}</td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="More options">
                                    <MoreVertical size={16} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleAssignStudent(cls.id)}>
                                    <UserPlus size={14} className="mr-2" />
                                    Add Student
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAssignSubject(cls.id)}>
                                    <BookOpen size={14} className="mr-2" />
                                    Assign Subject
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewSubjects(cls)}>
                                    <Eye size={14} className="mr-2" />
                                    View Subjects
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditClass(cls)}>
                                    <Edit size={14} className="mr-2" />
                                    Edit Class
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteClass(cls)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 size={14} className="mr-2" />
                                    Delete Class
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredClasses.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchQuery || levelFilter !== 'all' 
                ? 'No classes match your filters' 
                : 'No classes found. Create your first class!'}
            </CardContent>
          </Card>
        ) : (
          filteredClasses.map((cls) => {
            const classTeacher = getClassTeacher(cls.id);
            return (
              <Card key={cls.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-display">
                        {cls.name} {cls.arm}
                      </CardTitle>
                      <Badge 
                        variant="outline" 
                        className={`mt-1 ${levelColors[cls.level]}`}
                      >
                        {cls.level.replace('_', ' ')}
                      </Badge>
                    </div>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="More options">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAssignStudent(cls.id)}>
                            <UserPlus size={14} className="mr-2" />
                            Add Student
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAssignSubject(cls.id)}>
                            <BookOpen size={14} className="mr-2" />
                            Assign Subject
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewSubjects(cls)}>
                            <Eye size={14} className="mr-2" />
                            View Subjects
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditClass(cls)}>
                            <Edit size={14} className="mr-2" />
                            Edit Class
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClass(cls)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 size={14} className="mr-2" />
                            Delete Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {classTeacher && (
                      <div className="flex items-center gap-2 text-sm">
                        <GraduationCap size={16} className="text-muted-foreground" />
                        <span className="text-muted-foreground">Class Teacher:</span>
                        <span className="text-foreground font-medium">
                          {classTeacher.first_name} {classTeacher.last_name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-secondary" />
                        <span className="text-sm text-foreground">
                          {getClassStudentCount(cls.id)} students
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-primary" />
                        <span className="text-sm text-foreground">
                          {getClassSubjectCount(cls.id)} subjects
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      )}

      {/* Dialogs */}
      <AddClassDialog open={addClassOpen} onOpenChange={setAddClassOpen} />
      <AssignStudentToClassDialog 
        open={assignStudentOpen} 
        onOpenChange={setAssignStudentOpen}
        classId={selectedClassId}
      />
      <AssignSubjectDialog
        open={assignSubjectOpen}
        onOpenChange={setAssignSubjectOpen}
        classId={selectedClassId}
      />
      <EditClassDialog
        open={editClassOpen}
        onOpenChange={setEditClassOpen}
        classArm={selectedClassArm}
      />
      <ClassSubjectsDialog
        open={viewSubjectsOpen}
        onOpenChange={setViewSubjectsOpen}
        classId={selectedClassId}
        className={selectedClassName}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedClassArm?.name} {selectedClassArm?.arm}? 
              This action cannot be undone. Students assigned to this class will need to be reassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteClass}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

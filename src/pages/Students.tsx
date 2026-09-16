import { useState } from 'react';
import { ViewToggle, type ViewMode } from '@/components/shared/ViewToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents, useDeleteStudent, StudentWithClass } from '@/hooks/useStudents';
import { useClassArms } from '@/hooks/useClassArms';
import {
  Search,
  Download,
  Upload,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Database } from '@/integrations/supabase/types';
import { AddStudentDialog } from '@/components/principal/AddStudentDialog';
import { BulkImportStudentsDialog } from '@/components/principal/BulkImportStudentsDialog';
import { toast } from 'sonner';

type EnrollmentStatus = Database['public']['Enums']['enrollment_status'];

const statusColors: Record<EnrollmentStatus, string> = {
  active: 'bg-success/10 text-success border-success/20',
  graduated: 'bg-secondary/10 text-secondary border-secondary/20',
  transferred: 'bg-accent/10 text-accent-foreground border-accent/20',
  suspended: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function Students() {
  const { user } = useAuth();
  const { data: students = [], isLoading } = useStudents();
  const { data: classArms = [] } = useClassArms();
  const deleteStudent = useDeleteStudent();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentWithClass | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentWithClass | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentWithClass | null>(null);

  const filteredStudents = students.filter((student) => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      student.admission_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    const classDisplayName = student.class_arms 
      ? `${student.class_arms.name} ${student.class_arms.arm}` 
      : '';
    const matchesClass = classFilter === 'all' || classDisplayName === classFilter;
    const matchesStatus = statusFilter === 'all' || student.enrollment_status === statusFilter;
    
    return matchesSearch && matchesClass && matchesStatus;
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  const stats = {
    total: students.length,
    active: students.filter(s => s.enrollment_status === 'active').length,
    graduated: students.filter(s => s.enrollment_status === 'graduated').length,
  };

  const uniqueClasses = [...new Set(
    classArms.map(c => `${c.name} ${c.arm}`)
  )];

  const handleViewProfile = (student: StudentWithClass) => {
    setViewingStudent(student);
  };

  const handleEdit = (student: StudentWithClass) => {
    setEditingStudent(student);
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    
    try {
      await deleteStudent.mutateAsync(deletingStudent.id);
      toast.success('Student deleted successfully');
      setDeletingStudent(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete student');
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
          <h1 className="text-3xl font-bold text-foreground font-display">Students</h1>
          <p className="text-muted-foreground mt-1">
            Manage student records and information
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setBulkImportOpen(true)}>
              <Upload size={18} />
              Bulk Import
            </Button>
            <Button className="btn-accent gap-2" onClick={() => setAddDialogOpen(true)}>
              <UserPlus size={18} />
              Add Student
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Students</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-success mt-1">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Graduated</p>
            <p className="text-2xl font-bold text-secondary mt-1">{stats.graduated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Classes</p>
            <p className="text-2xl font-bold text-foreground mt-1">{classArms.length}</p>
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
                placeholder="Search by name or admission number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {uniqueClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download size={18} />
              Export
            </Button>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </CardContent>
      </Card>

      {viewMode === 'card' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-8 text-center text-muted-foreground">
                {searchQuery || classFilter !== 'all' || statusFilter !== 'all'
                  ? 'No students match your filters'
                  : 'No students found. Add your first student!'}
              </CardContent>
            </Card>
          ) : (
            filteredStudents.map((student) => (
              <Card key={student.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={student.avatar_url || undefined} />
                        <AvatarFallback>
                          {student.first_name.charAt(0)}
                          {student.last_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {student.last_name}, {student.first_name} {student.middle_name?.[0] ? `${student.middle_name[0]}.` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">{student.admission_number}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="More options">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewProfile(student)}>
                          <Eye size={14} className="mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(student)}>
                              <Edit size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingStudent(student)}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {student.class_arms ? `${student.class_arms.name} ${student.class_arms.arm}` : '-'}
                      {' • '}
                      <span className="capitalize">{student.gender}</span>
                    </span>
                    {student.enrollment_status && (
                      <Badge variant="outline" className={statusColors[student.enrollment_status]}>
                        {student.enrollment_status}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
      <>
      {/* Students Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Student</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Admission No.</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Class</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Gender</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-4 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {searchQuery || classFilter !== 'all' || statusFilter !== 'all' 
                        ? 'No students match your filters' 
                        : 'No students found. Add your first student!'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={student.avatar_url || undefined} />
                            <AvatarFallback>
                              {student.first_name.charAt(0)}
                              {student.last_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {student.last_name}, {student.first_name} {student.middle_name?.[0] ? `${student.middle_name[0]}.` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-foreground">{student.admission_number}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-foreground">
                          {student.class_arms ? `${student.class_arms.name} ${student.class_arms.arm}` : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm capitalize text-foreground">{student.gender}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {student.enrollment_status && (
                            <Badge
                              variant="outline"
                              className={statusColors[student.enrollment_status]}
                            >
                              {student.enrollment_status}
                            </Badge>
                          )}
                          {!student.user_id && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300" title="This student has no linked login account">
                              No login
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="More options">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewProfile(student)}>
                              <Eye size={14} className="mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(student)}>
                                  <Edit size={14} className="mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => setDeletingStudent(student)}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredStudents.length} of {students.length} students
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
      </div>

      {/* Add Student Dialog */}
      <AddStudentDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen}
      />

      {/* Bulk Import Dialog */}
      <BulkImportStudentsDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
      />

      {/* Edit Student Dialog */}
      <AddStudentDialog 
        open={!!editingStudent} 
        onOpenChange={(open) => !open && setEditingStudent(null)}
        student={editingStudent}
      />

      {/* View Profile Dialog */}
      <AlertDialog open={!!viewingStudent} onOpenChange={(open) => !open && setViewingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Student Profile</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={viewingStudent?.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {viewingStudent?.first_name.charAt(0)}
                      {viewingStudent?.last_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {viewingStudent?.first_name} {viewingStudent?.middle_name} {viewingStudent?.last_name}
                    </p>
                    <p className="text-muted-foreground">{viewingStudent?.admission_number}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Class</p>
                    <p className="font-medium text-foreground">
                      {viewingStudent?.class_arms ? `${viewingStudent.class_arms.name} ${viewingStudent.class_arms.arm}` : 'Not assigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gender</p>
                    <p className="font-medium capitalize text-foreground">{viewingStudent?.gender}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date of Birth</p>
                    <p className="font-medium text-foreground">{viewingStudent?.date_of_birth || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge
                      variant="outline"
                      className={viewingStudent?.enrollment_status ? statusColors[viewingStudent.enrollment_status] : ''}
                    >
                      {viewingStudent?.enrollment_status}
                    </Badge>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {isAdmin && (
              <AlertDialogAction onClick={() => {
                setViewingStudent(null);
                setEditingStudent(viewingStudent);
              }}>
                Edit Student
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingStudent} onOpenChange={(open) => !open && setDeletingStudent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingStudent?.first_name} {deletingStudent?.last_name}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
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

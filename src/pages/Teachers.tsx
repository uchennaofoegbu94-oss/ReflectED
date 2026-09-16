import { useState } from 'react';
import { ViewToggle, type ViewMode } from '@/components/shared/ViewToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff, useDeleteStaff, StaffWithRole } from '@/hooks/useStaff';
import { AddTeacherDialog } from '@/components/principal/AddTeacherDialog';
import { BulkImportTeachersDialog } from '@/components/principal/BulkImportTeachersDialog';
import { AssignRoleDialog } from '@/components/principal/AssignRoleDialog';
import { useSpecialRoles, ROLE_LABELS } from '@/hooks/useSpecialRoles';
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
  Shield,
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
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  inactive: 'bg-muted text-muted-foreground border-muted',
  on_leave: 'bg-accent/10 text-accent-foreground border-accent/20',
};

export default function Teachers() {
  const { user } = useAuth();
  const { data: staff = [], isLoading } = useStaff();
  const { data: specialRoles = [] } = useSpecialRoles();
  const deleteStaff = useDeleteStaff();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<StaffWithRole | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<StaffWithRole | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<StaffWithRole | null>(null);

  const filteredStaff = staff.filter((member) => {
    const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      member.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || member.employment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  const stats = {
    total: staff.length,
    active: staff.filter(s => s.employment_status === 'active').length,
    onLeave: staff.filter(s => s.employment_status === 'on_leave').length,
  };

  const getStaffRoles = (staffId: string) => {
    return specialRoles
      .filter(r => r.staff_id === staffId && r.is_active)
      .map(r => ROLE_LABELS[r.role_type])
      .slice(0, 2);
  };

  const handleViewProfile = (teacher: StaffWithRole) => {
    setViewingTeacher(teacher);
  };

  const handleEdit = (teacher: StaffWithRole) => {
    setEditingTeacher(teacher);
  };

  const handleDelete = async () => {
    if (!deletingTeacher) return;
    
    try {
      await deleteStaff.mutateAsync(deletingTeacher.id);
      toast.success('Teacher deleted successfully');
      setDeletingTeacher(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete teacher');
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
          <h1 className="text-3xl font-bold text-foreground font-display">Teachers</h1>
          <p className="text-muted-foreground mt-1">
            Manage teaching staff and their roles
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setBulkImportOpen(true)}>
              <Upload size={18} />
              Bulk Import
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setRoleDialogOpen(true)}>
              <Shield size={18} />
              Assign Role
            </Button>
            <Button className="btn-accent gap-2" onClick={() => setAddDialogOpen(true)}>
              <UserPlus size={18} />
              Add Teacher
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Teachers</p>
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
            <p className="text-sm text-muted-foreground">On Leave</p>
            <p className="text-2xl font-bold text-accent-foreground mt-1">{stats.onLeave}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Special Roles</p>
            <p className="text-2xl font-bold text-secondary mt-1">
              {specialRoles.filter(r => r.staff_id && r.is_active).length}
            </p>
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
                placeholder="Search by name, employee ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
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
          {filteredStaff.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-8 text-center text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'No teachers match your filters'
                  : 'No teachers found. Add your first teacher!'}
              </CardContent>
            </Card>
          ) : (
            filteredStaff.map((member) => (
              <Card key={member.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>
                          {member.first_name.charAt(0)}
                          {member.last_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {member.last_name}, {member.first_name} {member.middle_name?.[0] ? `${member.middle_name[0]}.` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">{member.employee_id}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="More options">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewProfile(member)}>
                          <Eye size={14} className="mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(member)}>
                              <Edit size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingTeacher(member)}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="text-foreground truncate">{member.email}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground capitalize">{member.gender}</span>
                      <div className="flex items-center gap-1">
                        {!member.user_id && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300" title="This staff member has no linked login account">
                            No login
                          </Badge>
                        )}
                        <Badge variant="outline" className={statusColors[member.employment_status] || statusColors.active}>
                          {member.employment_status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {getStaffRoles(member.id).map((role, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{role}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
      <>
      {/* Teachers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Teacher</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Employee ID</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Contact</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Gender</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Roles</th>
                  <th className="text-left py-4 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right py-4 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'No teachers match your filters' 
                        : 'No teachers found. Add your first teacher!'}
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((member) => (
                    <tr key={member.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback>
                              {member.first_name.charAt(0)}
                              {member.last_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {member.last_name}, {member.first_name} {member.middle_name?.[0] ? `${member.middle_name[0]}.` : ''}
                            </p>
                            <p className="text-sm text-muted-foreground">{member.qualification || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-foreground">{member.employee_id}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-foreground">{member.email}</p>
                          <p className="text-muted-foreground">{member.phone || 'No phone'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm capitalize text-foreground">{member.gender}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {getStaffRoles(member.id).map((role, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                          {getStaffRoles(member.id).length === 0 && (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant="outline"
                          className={statusColors[member.employment_status] || statusColors.active}
                        >
                          {member.employment_status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="More options">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewProfile(member)}>
                              <Eye size={14} className="mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            {isAdmin && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(member)}>
                                  <Edit size={14} className="mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => setDeletingTeacher(member)}
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
          Showing {filteredStaff.length} of {staff.length} teachers
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

      {/* Add Teacher Dialog */}
      <AddTeacherDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen}
      />

      {/* Bulk Import Dialog */}
      <BulkImportTeachersDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
      />

      {/* Edit Teacher Dialog */}
      <AddTeacherDialog 
        open={!!editingTeacher} 
        onOpenChange={(open) => !open && setEditingTeacher(null)}
        teacher={editingTeacher}
      />

      {/* Assign Role Dialog */}
      <AssignRoleDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen} type="staff" />

      {/* View Profile Dialog */}
      <AlertDialog open={!!viewingTeacher} onOpenChange={(open) => !open && setViewingTeacher(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Teacher Profile</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={viewingTeacher?.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {viewingTeacher?.first_name.charAt(0)}
                      {viewingTeacher?.last_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      {viewingTeacher?.first_name} {viewingTeacher?.middle_name} {viewingTeacher?.last_name}
                    </p>
                    <p className="text-muted-foreground">{viewingTeacher?.employee_id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{viewingTeacher?.email}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{viewingTeacher?.phone || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gender</p>
                    <p className="font-medium capitalize text-foreground">{viewingTeacher?.gender}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge
                      variant="outline"
                      className={viewingTeacher?.employment_status ? statusColors[viewingTeacher.employment_status] : ''}
                    >
                      {viewingTeacher?.employment_status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Qualification</p>
                    <p className="font-medium text-foreground">{viewingTeacher?.qualification || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employment Date</p>
                    <p className="font-medium text-foreground">{viewingTeacher?.employment_date || 'Not set'}</p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {isAdmin && (
              <AlertDialogAction onClick={() => {
                setViewingTeacher(null);
                setEditingTeacher(viewingTeacher);
              }}>
                Edit Teacher
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingTeacher} onOpenChange={(open) => !open && setDeletingTeacher(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Teacher</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingTeacher?.first_name} {deletingTeacher?.last_name}? 
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

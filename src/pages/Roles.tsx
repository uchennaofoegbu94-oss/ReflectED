import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useSpecialRoles, useDeleteSpecialRole, SpecialRoleType } from '@/hooks/useSpecialRoles';
import { useRoleDefinitions, useCreateRoleDefinition, useUpdateRoleDefinition, useDeleteRoleDefinition, RoleDefinition } from '@/hooks/useRoleDefinitions';
import { useStaff } from '@/hooks/useStaff';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useAllPermissionGrants, useGrantPermissions, useRevokePermission,
  PERMISSION_LABELS, ALL_PERMISSIONS, type PermissionKey,
} from '@/hooks/usePermissions';
import { useStudents } from '@/hooks/useStudents';
import { useClassArms } from '@/hooks/useClassArms';
import { AssignRoleDialog } from '@/components/principal/AssignRoleDialog';
import { PendingApprovalsCard } from '@/components/shared/PendingApprovalsCard';
import {
  Search,
  Shield,
  UserCheck,
  Users,
  Loader2,
  Trash2,
  GraduationCap,
  Plus,
  Edit,
  Save,
  X,
  Clock,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Roles() {
  const { user } = useAuth();
  const { data: specialRoles = [], isLoading } = useSpecialRoles();
  const { data: allRoleDefinitions = [] } = useRoleDefinitions();
  const { data: staff = [] } = useStaff();
  const { data: students = [] } = useStudents();
  const { data: classArms = [] } = useClassArms();
  const deleteRole = useDeleteSpecialRole();
  const createRoleDef = useCreateRoleDefinition();
  const updateRoleDef = useUpdateRoleDefinition();
  const deleteRoleDef = useDeleteRoleDefinition();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [staffRoleDialogOpen, setStaffRoleDialogOpen] = useState(false);
  const [studentRoleDialogOpen, setStudentRoleDialogOpen] = useState(false);
  const [showCreateRoleDef, setShowCreateRoleDef] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleCategory, setNewRoleCategory] = useState<'staff' | 'student'>('staff');
  const [editingRoleDef, setEditingRoleDef] = useState<RoleDefinition | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  // Build role labels from DB
  const roleLabelsMap: Record<string, string> = {};
  allRoleDefinitions.forEach(r => { roleLabelsMap[r.key] = r.label; });

  const staffRoles = specialRoles.filter(r => r.staff_id && r.is_active);
  const studentRoles = specialRoles.filter(r => r.student_id && r.is_active);

  const getPersonInfo = (role: any) => {
    if (role.staff_id) {
      const member = staff.find(s => s.id === role.staff_id);
      return member ? {
        name: `${member.first_name} ${member.last_name}`,
        avatar: member.avatar_url,
        detail: member.employee_id,
      } : null;
    }
    if (role.student_id) {
      const student = students.find(s => s.id === role.student_id);
      return student ? {
        name: `${student.first_name} ${student.last_name}`,
        avatar: student.avatar_url,
        detail: student.admission_number,
      } : null;
    }
    return null;
  };

  const getClassName = (classId: string | null) => {
    if (!classId) return null;
    const cls = classArms.find(c => c.id === classId);
    return cls ? `${cls.name} ${cls.arm}` : null;
  };

  const handleDeleteRole = async (id: string) => {
    if (!confirm('Are you sure you want to remove this role?')) return;
    try {
      await deleteRole.mutateAsync(id);
      toast.success('Role removed successfully');
    } catch {
      toast.error('Failed to remove role');
    }
  };

  const filterRoles = (roles: typeof specialRoles) => {
    return roles.filter((role) => {
      const person = getPersonInfo(role);
      if (!person) return false;
      const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || role.role_type === roleFilter || role.custom_role_name === roleFilter;
      return matchesSearch && matchesRole;
    });
  };

  const handleCreateRoleDef = async () => {
    if (!newRoleLabel.trim() || !user?.id) return;
    const key = newRoleLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    await createRoleDef.mutateAsync({
      key,
      label: newRoleLabel.trim(),
      category: newRoleCategory,
      created_by: user.id,
    });
    setNewRoleLabel('');
    setShowCreateRoleDef(false);
  };

  const handleUpdateRoleDef = async () => {
    if (!editingRoleDef || !editLabel.trim()) return;
    await updateRoleDef.mutateAsync({ id: editingRoleDef.id, label: editLabel.trim() });
    setEditingRoleDef(null);
  };

  const handleDeleteRoleDef = async (id: string) => {
    if (!confirm('Delete this role definition? This cannot be undone.')) return;
    await deleteRoleDef.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const getRoleLabel = (role: any) => {
    if (role.custom_role_name) {
      const def = allRoleDefinitions.find(r => r.key === role.custom_role_name);
      return def?.label || role.custom_role_name;
    }
    return roleLabelsMap[role.role_type] || role.role_type;
  };

  const RoleCard = ({ role }: { role: any }) => {
    const person = getPersonInfo(role);
    const className = getClassName(role.class_id);
    if (!person) return null;

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={person.avatar || undefined} />
                <AvatarFallback>
                  {person.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{person.name}</p>
                <p className="text-sm text-muted-foreground">{person.detail}</p>
              </div>
            </div>
            {isAdmin && (
              <Button 
                variant="ghost" 
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteRole(role.id)}
               title="Delete">
                <Trash2 size={16} />
              </Button>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="font-medium">
                {getRoleLabel(role)}
              </Badge>
              {className && (
                <span className="text-sm text-muted-foreground">{className}</span>
              )}
            </div>
            {role.notes && (
              <p className="text-sm text-muted-foreground">{role.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Assigned {format(new Date(role.assigned_at), 'MMM d, yyyy')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const staffRoleDefs = allRoleDefinitions.filter(r => r.category === 'staff');
  const studentRoleDefs = allRoleDefinitions.filter(r => r.category === 'student');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">Special Roles</h1>
          <p className="text-muted-foreground mt-1">
            Manage teacher and student special designations
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" className="gap-2" onClick={() => setShowCreateRoleDef(true)}>
            <Plus size={16} />
            Create New Role
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Assignments</p>
            <p className="text-2xl font-bold text-foreground mt-1">{specialRoles.filter(r => r.is_active).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Teacher Roles</p>
            <p className="text-2xl font-bold text-secondary mt-1">{staffRoles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Student Roles</p>
            <p className="text-2xl font-bold text-primary mt-1">{studentRoles.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Role Definitions</p>
            <p className="text-2xl font-bold text-foreground mt-1">{allRoleDefinitions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="staff" className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="staff" className="gap-2">
              <GraduationCap size={16} />
              Teacher Roles ({staffRoles.length})
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2">
              <Users size={16} />
              Student Roles ({studentRoles.length})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="manage" className="gap-2">
                <Shield size={16} />
                Manage Definitions
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="permissions" className="gap-2">
                <UserCheck size={16} />
                Permissions
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="approvals" className="gap-2">
                <Clock size={16} />
                Approvals
              </TabsTrigger>
            )}
          </TabsList>
          
          {isAdmin && (
            <div className="flex gap-2">
              <TabsContent value="staff" className="m-0">
                <Button className="btn-accent gap-2" onClick={() => setStaffRoleDialogOpen(true)}>
                  <Shield size={18} />
                  Assign Teacher Role
                </Button>
              </TabsContent>
              <TabsContent value="students" className="m-0">
                <Button className="btn-accent gap-2" onClick={() => setStudentRoleDialogOpen(true)}>
                  <UserCheck size={18} />
                  Assign Student Role
                </Button>
              </TabsContent>
            </div>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {allRoleDefinitions.map((rd) => (
                    <SelectItem key={rd.key} value={rd.key}>{rd.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="staff" className="space-y-4 m-0">
          {filterRoles(staffRoles).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery || roleFilter !== 'all' 
                  ? 'No teacher roles match your filters' 
                  : 'No teacher roles assigned yet'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filterRoles(staffRoles).map((role) => (
                <RoleCard key={role.id} role={role} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-4 m-0">
          {filterRoles(studentRoles).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery || roleFilter !== 'all' 
                  ? 'No student roles match your filters' 
                  : 'No student roles assigned yet'}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filterRoles(studentRoles).map((role) => (
                <RoleCard key={role.id} role={role} />
              ))}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="manage" className="space-y-6 m-0">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Staff Roles */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Staff Role Definitions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {staffRoleDefs.map((rd) => (
                    <div key={rd.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      {editingRoleDef?.id === rd.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="h-8"
                          />
                          <Button size="icon" variant="ghost" onClick={handleUpdateRoleDef} title="Save">
                            <Save size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingRoleDef(null)} title="Cancel">
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{rd.label}</span>
                            {rd.is_system && <Badge variant="outline" className="text-xs">System</Badge>}
                          </div>
                          {!rd.is_system ? (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingRoleDef(rd); setEditLabel(rd.label); }} title="Edit">
                                <Edit size={14} />
                              </Button>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteRoleDef(rd.id)} title="Delete">
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingRoleDef(rd); setEditLabel(rd.label); }} title="Edit">
                                <Edit size={14} />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Student Roles */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Student Role Definitions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {studentRoleDefs.map((rd) => (
                    <div key={rd.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      {editingRoleDef?.id === rd.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="h-8"
                          />
                          <Button size="icon" variant="ghost" onClick={handleUpdateRoleDef} title="Save">
                            <Save size={14} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingRoleDef(null)} title="Cancel">
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{rd.label}</span>
                            {rd.is_system && <Badge variant="outline" className="text-xs">System</Badge>}
                          </div>
                          {!rd.is_system ? (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingRoleDef(rd); setEditLabel(rd.label); }} title="Edit">
                                <Edit size={14} />
                              </Button>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteRoleDef(rd.id)} title="Delete">
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingRoleDef(rd); setEditLabel(rd.label); }} title="Edit">
                                <Edit size={14} />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="permissions" className="space-y-6 m-0">
            <PermissionsTab staff={staff} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="approvals" className="space-y-6 m-0">
            <PendingApprovalsCard />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <AssignRoleDialog open={staffRoleDialogOpen} onOpenChange={setStaffRoleDialogOpen} type="staff" />
      <AssignRoleDialog open={studentRoleDialogOpen} onOpenChange={setStudentRoleDialogOpen} type="student" />

      {/* Create Role Definition Dialog */}
      <Dialog open={showCreateRoleDef} onOpenChange={setShowCreateRoleDef}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="e.g., Sports Director"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newRoleCategory} onValueChange={(v) => setNewRoleCategory(v as 'staff' | 'student')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff Role</SelectItem>
                  <SelectItem value="student">Student Role</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRoleDef(false)}>Cancel</Button>
            <Button onClick={handleCreateRoleDef} disabled={createRoleDef.isPending || !newRoleLabel.trim()}>
              {createRoleDef.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Delegated Permissions (#11) ───
function PermissionsTab({ staff }: { staff: Array<{ id: string; first_name: string; last_name: string; employee_id: string }> }) {
  const { data: grants = [], isLoading } = useAllPermissionGrants();
  const grantPermissions = useGrantPermissions();
  const revokePermission = useRevokePermission();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([]);

  const grantsByStaff = new Map<string, typeof grants>();
  grants.forEach((g) => {
    if (!grantsByStaff.has(g.staff_id)) grantsByStaff.set(g.staff_id, []);
    grantsByStaff.get(g.staff_id)!.push(g);
  });

  const toggleStaff = (id: string) => {
    setSelectedStaffIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };
  const togglePermission = (key: PermissionKey) => {
    setSelectedPermissions((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]);
  };

  const handleGrant = async () => {
    if (selectedStaffIds.length === 0 || selectedPermissions.length === 0) return;
    await grantPermissions.mutateAsync({ staffIds: selectedStaffIds, permissions: selectedPermissions });
    setDialogOpen(false);
    setSelectedStaffIds([]);
    setSelectedPermissions([]);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">Delegated Permissions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Grant specific admin capabilities to individual staff, independent of their base role.
                Applies platform-wide within the school.
              </p>
            </div>
            <Button className="btn-accent gap-2" onClick={() => setDialogOpen(true)}>
              <Shield size={18} />
              Grant Permissions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : grantsByStaff.size === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No permissions have been delegated yet</p>
          ) : (
            <div className="space-y-3">
              {Array.from(grantsByStaff.entries()).map(([staffId, staffGrants]) => (
                <div key={staffId} className="p-3 rounded-lg border border-border">
                  <p className="text-sm font-medium mb-2">
                    {staffGrants[0].staff ? `${staffGrants[0].staff.first_name} ${staffGrants[0].staff.last_name}` : 'Staff member'}
                    {staffGrants[0].staff?.employee_id && <span className="text-muted-foreground font-normal"> ({staffGrants[0].staff.employee_id})</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {staffGrants.map((g) => (
                      <Badge key={g.id} variant="secondary" className="gap-1.5 pr-1">
                        {PERMISSION_LABELS[g.permission]}
                        <button
                          onClick={() => revokePermission.mutate({ id: g.id, staff_id: g.staff_id, permission: g.permission })}
                          className="hover:text-destructive"
                          disabled={revokePermission.isPending}
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Grant Permissions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Staff (select one or more)</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                {staff.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`staff-${s.id}`}
                      checked={selectedStaffIds.includes(s.id)}
                      onCheckedChange={() => toggleStaff(s.id)}
                    />
                    <label htmlFor={`staff-${s.id}`} className="text-sm cursor-pointer">
                      {s.first_name} {s.last_name} <span className="text-muted-foreground">({s.employee_id})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Permissions (select one or more)</Label>
              <div className="space-y-1 border border-border rounded-lg p-2">
                {ALL_PERMISSIONS.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`perm-${key}`}
                      checked={selectedPermissions.includes(key)}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <label htmlFor={`perm-${key}`} className="text-sm cursor-pointer">{PERMISSION_LABELS[key]}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleGrant}
              disabled={grantPermissions.isPending || selectedStaffIds.length === 0 || selectedPermissions.length === 0}
            >
              {grantPermissions.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
              Grant to {selectedStaffIds.length || 0} staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject } from '@/hooks/useSubjects';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  BookOpen,
  Loader2,
  Hash,
  Edit,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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

export default function Subjects() {
  const { user } = useAuth();
  const { data: subjects = [], isLoading } = useSubjects();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();
  const [searchQuery, setSearchQuery] = useState('');
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const filteredSubjects = subjects.filter((subject) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      subject.name.toLowerCase().includes(searchLower) ||
      subject.code.toLowerCase().includes(searchLower)
    );
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  const handleCreateSubject = async () => {
    if (!subjectName.trim() || !subjectCode.trim()) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      await createSubject.mutateAsync({
        name: subjectName.trim(),
        code: subjectCode.trim().toUpperCase(),
        description: subjectDescription.trim() || null,
      });
      toast.success('Subject created successfully');
      setAddSubjectOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create subject');
    }
  };

  const handleEditSubject = (subject: any) => {
    setSelectedSubjectId(subject.id);
    setSubjectName(subject.name);
    setSubjectCode(subject.code);
    setSubjectDescription(subject.description || '');
    setEditSubjectOpen(true);
  };

  const handleUpdateSubject = async () => {
    if (!selectedSubjectId || !subjectName.trim() || !subjectCode.trim()) {
      toast.error('Please fill in required fields');
      return;
    }
    try {
      await updateSubject.mutateAsync({
        id: selectedSubjectId,
        name: subjectName.trim(),
        code: subjectCode.trim().toUpperCase(),
        description: subjectDescription.trim() || null,
      });
      toast.success('Subject updated successfully');
      setEditSubjectOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update subject');
    }
  };

  const handleDeleteSubject = (subject: any) => {
    setSelectedSubjectId(subject.id);
    setSubjectName(subject.name);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteSubject = async () => {
    if (!selectedSubjectId) return;
    try {
      await deleteSubject.mutateAsync(selectedSubjectId);
      toast.success('Subject deleted successfully');
      setDeleteDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete subject. It may be in use by classes or classrooms.');
    }
  };

  const resetForm = () => {
    setSubjectName('');
    setSubjectCode('');
    setSubjectDescription('');
    setSelectedSubjectId(null);
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
          <h1 className="text-3xl font-bold text-foreground font-display">Subjects</h1>
          <p className="text-muted-foreground mt-1">
            Manage academic subjects offered in the school
          </p>
        </div>
        {isAdmin && (
          <Dialog open={addSubjectOpen} onOpenChange={(open) => { setAddSubjectOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="btn-accent gap-2">
                <Plus size={18} />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Subject</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Subject Name *</Label>
                  <Input id="name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g., Mathematics" />
                </div>
                <div>
                  <Label htmlFor="code">Subject Code *</Label>
                  <Input id="code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g., MATH" className="uppercase" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" value={subjectDescription} onChange={(e) => setSubjectDescription(e.target.value)} placeholder="Brief description of the subject..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setAddSubjectOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleCreateSubject} disabled={createSubject.isPending} className="btn-accent">
                  {createSubject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Subject
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Subjects</p>
              <p className="text-2xl font-bold text-foreground">{subjects.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search subjects by name or code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      {/* Subjects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">All Subjects</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No subjects match your search' : 'No subjects found. Add your first subject!'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  {isAdmin && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Hash size={14} className="text-muted-foreground" />
                        <span className="font-mono font-medium">{subject.code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-md truncate">
                      {subject.description || '-'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(subject.created_at).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="More options">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditSubject(subject)}>
                              <Edit size={14} className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteSubject(subject)} className="text-destructive focus:text-destructive">
                              <Trash2 size={14} className="mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Subject Dialog */}
      <Dialog open={editSubjectOpen} onOpenChange={(open) => { setEditSubjectOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Subject Name *</Label>
              <Input id="edit-name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g., Mathematics" />
            </div>
            <div>
              <Label htmlFor="edit-code">Subject Code *</Label>
              <Input id="edit-code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} placeholder="e.g., MATH" className="uppercase" />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" value={subjectDescription} onChange={(e) => setSubjectDescription(e.target.value)} placeholder="Brief description..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditSubjectOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpdateSubject} disabled={updateSubject.isPending} className="btn-accent">
              {updateSubject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{subjectName}"? This action cannot be undone. 
              The subject must not be assigned to any class to be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resetForm()}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSubject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteSubject.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

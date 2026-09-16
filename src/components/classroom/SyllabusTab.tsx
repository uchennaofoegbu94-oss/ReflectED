import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Edit2, Trash2, Loader2, BookOpen, Target, Activity, Package } from 'lucide-react';
import { useSyllabus, useCreateSyllabusItem, useUpdateSyllabusItem, useDeleteSyllabusItem } from '@/hooks/useClassroomManagement';

interface SyllabusTabProps {
  classroomId: string;
  isTeacher: boolean;
}

export function SyllabusTab({ classroomId, isTeacher }: SyllabusTabProps) {
  const { data: syllabus = [], isLoading } = useSyllabus(classroomId);
  const createItem = useCreateSyllabusItem();
  const updateItem = useUpdateSyllabusItem();
  const deleteItem = useDeleteSyllabusItem();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    week_number: '',
    topic: '',
    objectives: '',
    activities: '',
    resources: '',
    content: '',
  });

  const resetForm = () => {
    setFormData({
      title: '',
      week_number: '',
      topic: '',
      objectives: '',
      activities: '',
      resources: '',
      content: '',
    });
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    const data = {
      classroom_id: classroomId,
      title: formData.title.trim(),
      week_number: formData.week_number ? parseInt(formData.week_number) : undefined,
      topic: formData.topic.trim() || undefined,
      objectives: formData.objectives.trim() || undefined,
      activities: formData.activities.trim() || undefined,
      resources: formData.resources.trim() || undefined,
      content: formData.content.trim() || undefined,
    };

    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, classroomId, ...data });
    } else {
      await createItem.mutateAsync(data);
    }

    setShowAddDialog(false);
    resetForm();
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      week_number: item.week_number?.toString() || '',
      topic: item.topic || '',
      objectives: item.objectives || '',
      activities: item.activities || '',
      resources: item.resources || '',
      content: item.content || '',
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this syllabus item?')) {
      await deleteItem.mutateAsync({ id, classroomId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold font-display">Syllabus / Scheme of Work</h2>
          <p className="text-sm text-muted-foreground">Course outline and weekly topics</p>
        </div>
        {isTeacher && (
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-accent gap-2">
                <Plus size={18} />
                Add Topic
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Topic' : 'Add New Topic'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Week Number</Label>
                    <Input
                      type="number"
                      value={formData.week_number}
                      onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                      placeholder="e.g., 1"
                      min="1"
                    />
                  </div>
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Introduction to Algebra"
                    />
                  </div>
                </div>
                <div>
                  <Label>Topic</Label>
                  <Input
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    placeholder="Detailed topic description"
                  />
                </div>
                <div>
                  <Label>Learning Objectives</Label>
                  <Textarea
                    value={formData.objectives}
                    onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                    placeholder="What students will learn..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label>Activities</Label>
                  <Textarea
                    value={formData.activities}
                    onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                    placeholder="Class activities and exercises..."
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label>Resources</Label>
                  <Textarea
                    value={formData.resources}
                    onChange={(e) => setFormData({ ...formData, resources: e.target.value })}
                    placeholder="Textbooks, materials, links..."
                    className="min-h-[60px]"
                  />
                </div>
                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Any additional content..."
                    className="min-h-[60px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!formData.title.trim() || createItem.isPending || updateItem.isPending}
                >
                  {(createItem.isPending || updateItem.isPending) && (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  )}
                  {editingItem ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {syllabus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {isTeacher ? 'Add your course syllabus to help students follow along.' : 'No syllabus available yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {syllabus.map((item: any) => (
            <AccordionItem key={item.id} value={item.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  {item.week_number && (
                    <span className="px-2 py-1 rounded bg-secondary/10 text-secondary text-sm font-medium">
                      Week {item.week_number}
                    </span>
                  )}
                  <span className="font-medium">{item.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <div className="space-y-4">
                  {item.topic && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Topic</h4>
                      <p className="text-foreground">{item.topic}</p>
                    </div>
                  )}
                  
                  {item.objectives && (
                    <div className="flex gap-3">
                      <Target size={18} className="text-secondary shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Learning Objectives</h4>
                        <p className="text-foreground whitespace-pre-wrap">{item.objectives}</p>
                      </div>
                    </div>
                  )}
                  
                  {item.activities && (
                    <div className="flex gap-3">
                      <Activity size={18} className="text-success shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Activities</h4>
                        <p className="text-foreground whitespace-pre-wrap">{item.activities}</p>
                      </div>
                    </div>
                  )}
                  
                  {item.resources && (
                    <div className="flex gap-3">
                      <Package size={18} className="text-accent shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Resources</h4>
                        <p className="text-foreground whitespace-pre-wrap">{item.resources}</p>
                      </div>
                    </div>
                  )}
                  
                  {item.content && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-foreground whitespace-pre-wrap">{item.content}</p>
                    </div>
                  )}
                  
                  {isTeacher && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                        <Edit2 size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useClassroomMaterials, useCreateMaterial, useDeleteMaterial } from '@/hooks/useClassroomMaterials';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Plus,
  FileText,
  Link as LinkIcon,
  Download,
  Trash2,
  Upload,
  Loader2,
  File,
  Image,
  Video,
  FolderOpen,
} from 'lucide-react';

interface MaterialsTabProps {
  classroomId: string;
  isTeacher: boolean;
}

export function MaterialsTab({ classroomId, isTeacher }: MaterialsTabProps) {
  const { data: materials = [], isLoading } = useClassroomMaterials(classroomId);
  const createMaterial = useCreateMaterial();
  const deleteMaterial = useDeleteMaterial();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    topic: '',
    link_url: '',
    file_url: '',
    file_name: '',
    file_type: '',
    file_size: 0,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${classroomId}/materials/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('classroom-materials')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('classroom-materials')
        .getPublicUrl(data.path);

      setFormData(prev => ({
        ...prev,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
      }));

      toast.success('File uploaded');
    } catch (error: any) {
      toast.error('Upload failed: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    await createMaterial.mutateAsync({
      classroom_id: classroomId,
      title: formData.title,
      description: formData.description || undefined,
      topic: formData.topic || undefined,
      file_url: formData.file_url || undefined,
      file_name: formData.file_name || undefined,
      file_type: formData.file_type || undefined,
      file_size: formData.file_size || undefined,
      link_url: formData.link_url || undefined,
    });

    setFormData({ title: '', description: '', topic: '', link_url: '', file_url: '', file_name: '', file_type: '', file_size: 0 });
    setShowAddDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material?')) return;
    await deleteMaterial.mutateAsync({ id, classroomId });
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File size={20} />;
    if (type.startsWith('image/')) return <Image size={20} />;
    if (type.startsWith('video/')) return <Video size={20} />;
    return <FileText size={20} />;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isTeacher && (
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setShowAddDialog(true)}>
            <Plus size={16} />
            Add Material
          </Button>
        </div>
      )}

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No materials yet</h3>
            <p className="text-muted-foreground mt-2">
              {isTeacher ? 'Upload files and links for your students' : 'No materials have been shared yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <Card key={material.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-muted p-2.5 text-muted-foreground">
                    {material.file_url ? getFileIcon(material.file_type) : <LinkIcon size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{material.title}</h4>
                    {material.topic && (
                      <Badge variant="outline" className="mt-1 text-xs">{material.topic}</Badge>
                    )}
                    {material.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{material.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(material.created_at), 'MMM d, yyyy')}</span>
                      {material.file_size && <span>• {formatFileSize(material.file_size)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {material.file_url && (
                    <Button variant="outline" size="sm" className="gap-1 flex-1" asChild>
                      <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                        <Download size={14} /> Download
                      </a>
                    </Button>
                  )}
                  {material.link_url && (
                    <Button variant="outline" size="sm" className="gap-1 flex-1" asChild>
                      <a href={material.link_url} target="_blank" rel="noopener noreferrer">
                        <LinkIcon size={14} /> Open Link
                      </a>
                    </Button>
                  )}
                  {isTeacher && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(material.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Material Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Material title"
              />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input
                value={formData.topic}
                onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                placeholder="e.g., Chapter 3"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Upload File</Label>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {formData.file_name || 'Choose file'}
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Or Add Link</Label>
              <Input
                value={formData.link_url}
                onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://..."
                type="url"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMaterial.isPending}>
                {createMaterial.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
                Add Material
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

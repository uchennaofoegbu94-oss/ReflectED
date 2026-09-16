import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import {
  Send,
  Paperclip,
  Link as LinkIcon,
  Loader2,
  X,
  MessageSquare,
  FileText,
  Folder,
} from 'lucide-react';
import { toast } from 'sonner';

interface StreamTabProps {
  isTeacher: boolean;
  user: any;
  posts: any[];
  assignments: any[];
  isLoading: boolean;
  createPost: any;
  createComment: any;
  uploadFile: (file: File) => Promise<any>;
  onSwitchTab: (tab: string) => void;
}

export function StreamTab({
  isTeacher,
  user,
  posts,
  assignments,
  isLoading,
  createPost,
  createComment,
  uploadFile,
  onSwitchTab,
}: StreamTabProps) {
  const [newPost, setNewPost] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: 'file' | 'link' | 'video' | 'image' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadFile(file);
        setAttachments(prev => [...prev, result]);
      }
      toast.success('File(s) uploaded successfully');
    } catch (error: any) {
      toast.error('Failed to upload file: ' + error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddLink = () => {
    if (!linkName.trim() || !linkUrl.trim()) {
      toast.error('Please enter both name and URL');
      return;
    }
    setAttachments(prev => [...prev, { name: linkName, url: linkUrl, type: 'link' }]);
    setLinkName('');
    setLinkUrl('');
    setShowLinkDialog(false);
  };

  const handlePost = async () => {
    if (!newPost.trim()) {
      toast.error('Please enter a message');
      return;
    }
    await createPost.mutateAsync({ content: newPost, attachments });
    setNewPost('');
    setAttachments([]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <div className="lg:col-span-3 space-y-4">
        {/* New Post Input */}
        {isTeacher && (
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    placeholder="Share something with your class..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="min-h-[80px] resize-none border-0 p-0 focus-visible:ring-0"
                  />
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {attachments.map((att, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm">
                          {att.type === 'link' ? <LinkIcon size={14} /> : <Paperclip size={14} />}
                          <span className="max-w-[150px] truncate">{att.name}</span>
                          <button onClick={() => removeAttachment(index)} className="text-muted-foreground hover:text-destructive">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex gap-2">
                      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Attach a file">
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                      </Button>
                      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Add a link"><LinkIcon size={18} /></Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Add Link</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <div><Label>Link Name</Label><Input placeholder="e.g., Khan Academy Video" value={linkName} onChange={(e) => setLinkName(e.target.value)} /></div>
                            <div><Label>URL</Label><Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></div>
                          </div>
                          <DialogFooter><Button onClick={handleAddLink}>Add Link</Button></DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Button className="btn-teal gap-2" disabled={!newPost.trim() || createPost.isPending} onClick={handlePost}>
                      {createPost.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No posts yet. {isTeacher ? 'Share something with your class!' : 'Check back later for updates.'}</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post: any) => (
            <StreamPostCard
              key={post.id}
              post={post}
              onComment={async (content) => { await createComment.mutateAsync({ postId: post.id, content }); }}
            />
          ))
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base font-display">Upcoming</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.filter((a: any) => a.status === 'published').slice(0, 3).map((assignment: any) => (
                <div key={assignment.id} className="text-sm">
                  <p className="font-medium text-foreground line-clamp-1">{assignment.title}</p>
                  <p className="text-muted-foreground text-xs">Due: {assignment.due_date || 'No due date'}</p>
                </div>
              ))}
              {assignments.length === 0 && <p className="text-sm text-muted-foreground">No upcoming assignments</p>}
            </div>
            <Button variant="ghost" className="w-full mt-3 text-secondary" onClick={() => onSwitchTab('classwork')}>View All</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base font-display">Class Materials</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: 'Syllabus', icon: FileText, tab: 'syllabus' },
                { name: 'Course Notes', icon: Folder, tab: 'materials' },
                { name: 'Past Questions', icon: Folder, tab: 'past-questions' },
              ].map((item, index) => (
                <button
                  key={index}
                  className="flex items-center gap-3 w-full p-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                  onClick={() => onSwitchTab(item.tab)}
                >
                  <item.icon size={16} className="text-muted-foreground" />
                  {item.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Stream Post Card Component
function StreamPostCard({ post, onComment }: { post: any; onComment: (content: string) => Promise<void> }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      await onComment(newComment);
      setNewComment('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={post.is_pinned ? 'border-secondary' : ''}>
      <CardContent className="p-4">
        {post.is_pinned && <Badge className="mb-3 bg-secondary/10 text-secondary border-secondary/30">Pinned</Badge>}
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback>{post.profiles?.full_name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{post.profiles?.full_name || 'Unknown'}</p>
              <span className="text-sm text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="mt-2 text-foreground whitespace-pre-wrap">{post.content}</p>
            {post.attachments && post.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {post.attachments.map((att: any) => (
                  <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors">
                    {att.type === 'link' ? <LinkIcon size={14} /> : <Paperclip size={14} />}
                    {att.name}
                  </a>
                ))}
              </div>
            )}
            <div className="mt-4">
              <button onClick={() => setShowComments(!showComments)} className="text-sm text-secondary hover:underline">
                {post.post_comments?.length || 0} comments
              </button>
              {showComments && (
                <div className="mt-3 space-y-3">
                  {post.post_comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-2 pl-2 border-l-2 border-border">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={comment.profiles?.avatar_url} />
                        <AvatarFallback>{comment.profiles?.full_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">{comment.profiles?.full_name}</span>{' '}
                          <span className="text-foreground">{comment.content}</span>
                        </p>
                        <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <Input placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleComment()} className="flex-1" />
                    <Button size="icon" onClick={handleComment} disabled={!newComment.trim() || isSubmitting} title="Post comment">
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

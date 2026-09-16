import { StreamPost as StreamPostType } from '@/types';
import { MoreVertical, Pin, MessageCircle, Paperclip, Link as LinkIcon, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface StreamPostProps {
  post: StreamPostType;
}

export function StreamPost({ post }: StreamPostProps) {
  const [showComments, setShowComments] = useState(false);

  const getAttachmentIcon = (type: 'file' | 'link' | 'video') => {
    switch (type) {
      case 'link':
        return <LinkIcon size={14} />;
      case 'video':
        return <Video size={14} />;
      default:
        return <Paperclip size={14} />;
    }
  };

  return (
    <div className="stream-post">
      {post.isPinned && (
        <div className="flex items-center gap-1 text-xs text-secondary mb-2">
          <Pin size={12} />
          <span>Pinned</span>
        </div>
      )}
      
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.authorAvatar} />
          <AvatarFallback>{post.authorName.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-foreground">{post.authorName}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {new Date(post.createdAt).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="More options">
              <MoreVertical size={16} />
            </Button>
          </div>
          
          <p className="mt-2 text-foreground whitespace-pre-wrap">{post.content}</p>
          
          {post.attachments && post.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {getAttachmentIcon(attachment.type)}
                  <span className="max-w-[150px] truncate">{attachment.name}</span>
                </a>
              ))}
            </div>
          )}
          
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageCircle size={16} />
              <span>{post.comments.length} comments</span>
            </button>
          </div>
          
          {showComments && post.comments.length > 0 && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.authorAvatar} />
                    <AvatarFallback>{comment.authorName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-lg bg-muted/50 p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{comment.authorName}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

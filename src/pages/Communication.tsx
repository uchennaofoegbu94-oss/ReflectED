import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages, useSendMessage, useMarkMessageRead, Message } from '@/hooks/useMessages';
import {
  Search,
  Send,
  Inbox,
  SendHorizontal,
  Users,
  Loader2,
  Mail,
  MailOpen,
  Star,
  Trash2,
  Reply,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AnnouncementsPanel } from '@/components/communication/AnnouncementsPanel';
import { toast } from 'sonner';
import { format } from 'date-fns';

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  normal: 'bg-muted text-muted-foreground border-muted',
  low: 'bg-success/10 text-success border-success/20',
};

export default function Communication() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';
  const { data: messagesData, isLoading } = useMessages();
  const sendMessage = useSendMessage();
  const markRead = useMarkMessageRead();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [newMessage, setNewMessage] = useState({
    subject: '',
    content: '',
    priority: 'normal',
    is_broadcast: false,
    target_roles: [] as string[],
  });

  const { sentMessages: allSentMessages = [], receivedMessages: allReceivedMessages = [] } = messagesData || {};

  // The search box above only ever captured this value and never filtered
  // anything with it — this is the actual filtering that was missing.
  const matchesSearch = (msg: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      msg.messages?.subject?.toLowerCase().includes(q) ||
      msg.messages?.content?.toLowerCase().includes(q)
    );
  };
  const receivedMessages = allReceivedMessages.filter(matchesSearch);
  const sentMessages = allSentMessages.filter(matchesSearch);

  const allMessages = [
    ...sentMessages.map(m => ({ ...m, type: 'sent' })),
    ...receivedMessages.map(m => ({ ...m, type: 'received' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const unreadCount = receivedMessages.filter(m => !m.is_read).length;

  const handleSendMessage = async () => {
    if (!newMessage.subject.trim() || !newMessage.content.trim() || !user?.id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await sendMessage.mutateAsync({
        sender_id: user.id,
        subject: newMessage.subject,
        content: newMessage.content,
        priority: newMessage.priority,
        is_broadcast: newMessage.is_broadcast,
        target_roles: newMessage.target_roles.length > 0 ? newMessage.target_roles : undefined,
      });
      toast.success('Message sent successfully');
      setComposeOpen(false);
      setNewMessage({
        subject: '',
        content: '',
        priority: 'normal',
        is_broadcast: false,
        target_roles: [],
      });
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleMessageClick = async (message: any) => {
    setSelectedMessage(message);
    if (message.type === 'received' && !message.is_read) {
      await markRead.mutateAsync(message.id);
    }
  };

  const toggleRole = (role: string) => {
    setNewMessage(prev => ({
      ...prev,
      target_roles: prev.target_roles.includes(role)
        ? prev.target_roles.filter(r => r !== role)
        : [...prev.target_roles, role],
    }));
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
          <h1 className="text-3xl font-bold text-foreground font-display">Communication</h1>
          <p className="text-muted-foreground mt-1">
            Send messages and announcements to staff and students
          </p>
        </div>
        {!isAdmin && (
          <Button className="btn-accent gap-2" onClick={() => setComposeOpen(true)}>
            <Send size={18} />
            Compose Message
          </Button>
        )}
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Subject *</Label>
                <Input
                  placeholder="Enter message subject..."
                  value={newMessage.subject}
                  onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                />
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={newMessage.priority}
                    onValueChange={(v) => setNewMessage({ ...newMessage, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Type</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Checkbox
                      id="broadcast"
                      checked={newMessage.is_broadcast}
                      onCheckedChange={(c) => setNewMessage({ ...newMessage, is_broadcast: !!c })}
                    />
                    <label htmlFor="broadcast" className="text-sm">
                      Broadcast to all
                    </label>
                  </div>
                </div>
              </div>

              {newMessage.is_broadcast && (
                <div className="space-y-2">
                  <Label>Target Roles (leave empty for all)</Label>
                  <div className="flex flex-wrap gap-2">
                    {['teacher', 'student', 'parent', 'accountant'].map((role) => (
                      <Badge
                        key={role}
                        variant={newMessage.target_roles.includes(role) ? 'default' : 'outline'}
                        className="cursor-pointer capitalize"
                        onClick={() => toggleRole(role)}
                      >
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea
                  placeholder="Write your message here..."
                  rows={6}
                  value={newMessage.content}
                  onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setComposeOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  className="gap-2" 
                  onClick={handleSendMessage}
                  disabled={sendMessage.isPending}
                >
                  {sendMessage.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <SendHorizontal size={16} />
                  )}
                  Send Message
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Messages</p>
            <p className="text-2xl font-bold text-foreground mt-1">{allMessages.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Unread</p>
            <p className="text-2xl font-bold text-secondary mt-1">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Sent</p>
            <p className="text-2xl font-bold text-success mt-1">{sentMessages.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Received</p>
            <p className="text-2xl font-bold text-primary mt-1">{receivedMessages.length}</p>
          </CardContent>
        </Card>
      </div>

      <AnnouncementsPanel />

      {/* Messages */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Message List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 space-y-3">
            {isAdmin && (
              <Button className="btn-accent gap-2 w-full" onClick={() => setComposeOpen(true)}>
                <Send size={16} />
                Compose Message
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="inbox" className="w-full">
              <TabsList className="w-full rounded-none border-b">
                <TabsTrigger value="inbox" className="flex-1 gap-2">
                  <Inbox size={14} />
                  Inbox {unreadCount > 0 && <Badge variant="secondary" className="h-5 px-1.5">{unreadCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="sent" className="flex-1 gap-2">
                  <SendHorizontal size={14} />
                  Sent
                </TabsTrigger>
              </TabsList>
              <TabsContent value="inbox" className="m-0">
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {receivedMessages.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No messages received
                    </div>
                  ) : (
                    receivedMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                          !msg.is_read ? 'bg-secondary/5' : ''
                        } ${selectedMessage?.id === msg.id ? 'bg-muted' : ''}`}
                        onClick={() => handleMessageClick({ ...msg, type: 'received' })}
                      >
                        <div className="flex items-start gap-3">
                          {msg.is_read ? (
                            <MailOpen size={16} className="mt-1 text-muted-foreground" />
                          ) : (
                            <Mail size={16} className="mt-1 text-secondary" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-sm truncate ${!msg.is_read ? 'font-semibold' : ''}`}>
                                {msg.messages?.subject}
                              </p>
                              <Badge 
                                variant="outline" 
                                className={`shrink-0 text-xs ${priorityColors[msg.messages?.priority || 'normal']}`}
                              >
                                {msg.messages?.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {msg.messages?.content}
                            </p>
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <Clock size={12} />
                              {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              <TabsContent value="sent" className="m-0">
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {sentMessages.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No messages sent
                    </div>
                  ) : (
                    sentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedMessage?.id === msg.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleMessageClick({ ...msg, type: 'sent' })}
                      >
                        <div className="flex items-start gap-3">
                          <SendHorizontal size={16} className="mt-1 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm truncate font-medium">{msg.subject}</p>
                              <Badge 
                                variant="outline" 
                                className={`shrink-0 text-xs ${priorityColors[msg.priority || 'normal']}`}
                              >
                                {msg.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {msg.content}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {msg.is_broadcast && (
                                <Badge variant="secondary" className="text-xs">
                                  <Users size={10} className="mr-1" />
                                  Broadcast
                                </Badge>
                              )}
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock size={12} />
                                {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Message Detail */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            {selectedMessage ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {selectedMessage.type === 'received' 
                        ? selectedMessage.messages?.subject 
                        : selectedMessage.subject}
                    </h3>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge 
                        variant="outline" 
                        className={priorityColors[
                          selectedMessage.type === 'received' 
                            ? selectedMessage.messages?.priority 
                            : selectedMessage.priority
                        ] || priorityColors.normal}
                      >
                        {selectedMessage.type === 'received' 
                          ? selectedMessage.messages?.priority 
                          : selectedMessage.priority} priority
                      </Badge>
                      {(selectedMessage.type === 'sent' ? selectedMessage.is_broadcast : selectedMessage.messages?.is_broadcast) && (
                        <Badge variant="secondary">
                          <Users size={12} className="mr-1" />
                          Broadcast
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(selectedMessage.created_at), 'MMMM d, yyyy \'at\' h:mm a')}
                  </div>
                </div>
                
                <div className="border-t border-border pt-4">
                  <p className="text-foreground whitespace-pre-wrap">
                    {selectedMessage.type === 'received' 
                      ? selectedMessage.messages?.content 
                      : selectedMessage.content}
                  </p>
                </div>

                {selectedMessage.type === 'received' && (
                  <div className="flex gap-2 pt-4 border-t border-border">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Reply size={14} />
                      Reply
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 text-destructive">
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-80 text-muted-foreground">
                <Mail size={48} className="mb-4 opacity-50" />
                <p>Select a message to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

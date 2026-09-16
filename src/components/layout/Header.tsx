import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Database } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Search,
  ChevronDown,
  Menu,
  CheckCheck,
} from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { useGlobalSearch, CATEGORY_LABELS, type SearchResultCategory } from '@/hooks/useGlobalSearch';
import { useNotifications, useUnreadNotificationCount, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrator',
  principal: 'Principal',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent/Guardian',
  accountant: 'Accountant',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-primary text-primary-foreground',
  principal: 'bg-secondary text-secondary-foreground',
  teacher: 'bg-secondary text-secondary-foreground',
  student: 'bg-accent text-accent-foreground',
  parent: 'bg-success text-success-foreground',
  accountant: 'bg-muted text-muted-foreground',
};

interface HeaderProps {
  sidebarCollapsed?: boolean;
  onMenuClick?: () => void;
}

export function Header({ sidebarCollapsed, onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: results = [], isLoading: searching } = useGlobalSearch(searchQuery);
  const { data: notifications = [] } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleNotificationClick = (notification: { id: string; is_read: boolean | null; link: string | null }) => {
    if (!notification.is_read) markRead.mutate(notification.id);
    if (notification.link) navigate(notification.link);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<SearchResultCategory, typeof results>);

  const handleSelect = (path: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  return (
    <header
      className={`fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur-sm px-4 transition-all duration-300 ${
        sidebarCollapsed ? 'left-20' : 'left-64'
      } max-lg:left-0`}
    >
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="relative hidden w-96 md:flex items-center input-field pl-10 text-left text-muted-foreground hover:text-foreground transition-colors"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <span className="flex-1">Search students, staff, classes...</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder="Search students, staff, classes, library, announcements..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {searchQuery.trim().length < 2 ? (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          ) : searching ? (
            <CommandEmpty>Searching...</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>No results found.</CommandEmpty>
          ) : (
            (Object.entries(grouped) as [SearchResultCategory, typeof results][]).map(([category, items]) => (
              <CommandGroup key={category} heading={CATEGORY_LABELS[category]}>
                {items.map((item) => (
                  <CommandItem key={`${item.category}-${item.id}`} onSelect={() => handleSelect(item.path)}>
                    <div>
                      <p>{item.title}</p>
                      {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))
          )}
        </CommandList>
      </CommandDialog>

      <div className="flex items-center gap-3">
        {/* Role Display */}
        {user && (
          <Badge className={user.isSuperAdmin ? 'bg-primary text-primary-foreground' : roleColors[user.role]}>
            {user.isSuperAdmin ? 'Super Admin' : roleLabels[user.role]}
          </Badge>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck size={14} /> Mark all read
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              <ScrollArea className="h-80">
                {notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className={`flex flex-col items-start gap-0.5 whitespace-normal py-2.5 ${!n.is_read ? 'bg-muted/50' : ''}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex w-full items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-tight">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar */}
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-border">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback className="text-xs">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}

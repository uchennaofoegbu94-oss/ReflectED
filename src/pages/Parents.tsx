import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAllParents, useAdminUnlinkChild } from '@/hooks/useParents';
import { Search, Users, UserX } from 'lucide-react';

export default function Parents() {
  const { data: parents = [], isLoading } = useAllParents();
  const unlinkChild = useAdminUnlinkChild();
  const [search, setSearch] = useState('');

  const filtered = parents.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.children.some((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q))
    );
  });

  const unlinkedCount = parents.filter((p) => p.children.length === 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Parents</h1>
        <p className="text-muted-foreground mt-1">
          Everyone with a parent account at your school, and which children they're linked to
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-primary/10 text-primary"><Users size={20} /></div>
              <div>
                <p className="text-2xl font-bold">{parents.length}</p>
                <p className="text-xs text-muted-foreground">Parent accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-amber-500/10 text-amber-600"><UserX size={20} /></div>
              <div>
                <p className="text-2xl font-bold">{unlinkedCount}</p>
                <p className="text-xs text-muted-foreground">No children linked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by parent or child name..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">
            {parents.length === 0 ? 'No parent accounts yet' : 'No matches'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {parents.length === 0
              ? 'Parent accounts appear here once someone signs up with the parent role'
              : 'Try a different search'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((parent) => (
            <Card key={parent.user_id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={parent.avatar_url || undefined} />
                      <AvatarFallback>{parent.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{parent.full_name}</p>
                      <p className="text-sm text-muted-foreground">{parent.email}</p>
                      {parent.phone && <p className="text-xs text-muted-foreground">{parent.phone}</p>}
                    </div>
                  </div>

                  <div className="flex-1 min-w-[240px]">
                    {parent.children.length === 0 ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        No children linked
                      </Badge>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {parent.children.map((child) => (
                          <Badge key={child.id} variant="secondary" className="gap-2 pr-1">
                            {child.first_name} {child.last_name} ({child.admission_number})
                            <button
                              className="hover:text-destructive"
                              title="Unlink this child from this parent"
                              onClick={() => unlinkChild.mutate(child.id)}
                              disabled={unlinkChild.isPending}
                            >
                              <UserX size={12} />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

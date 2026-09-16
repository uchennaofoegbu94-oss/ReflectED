import { useState } from 'react';
import { ViewToggle, type ViewMode } from '@/components/shared/ViewToggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Plus, QrCode, Search, Trash2, Loader2, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLibraryBooks, useAddBook, useDeleteBook, useLibraryLoans, useMyLibraryLoans,
  useIsLibrarian, isLoanOverdue, type LibraryLoan,
} from '@/hooks/useLibrary';
import { LibraryScanner } from '@/components/library/LibraryScanner';
import { BookQRDialog } from '@/components/library/BookQRDialog';

export default function Library() {
  const { user } = useAuth();
  const canManage = useIsLibrarian();
  const isStaff = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'principal';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display flex items-center gap-2">
            <BookOpen className="h-7 w-7" /> Library
          </h1>
          <p className="text-muted-foreground mt-1">
            {canManage ? 'Manage the catalog and borrowing' : 'Browse the catalog and your loans'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          {canManage && <TabsTrigger value="loans">Loans</TabsTrigger>}
          {isStaff || user?.role === 'student' ? <TabsTrigger value="my-loans">My Loans</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <CatalogTab canManage={canManage} />
        </TabsContent>

        {canManage && (
          <TabsContent value="loans" className="mt-4">
            <LoansTab />
          </TabsContent>
        )}

        <TabsContent value="my-loans" className="mt-4">
          <MyLoansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogTab({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState('');
  const [resourceFilter, setResourceFilter] = useState<'all' | 'physical' | 'digital'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { data: allBooks = [], isLoading } = useLibraryBooks(search || undefined);
  const books = resourceFilter === 'all' ? allBooks : allBooks.filter(b => b.resource_type === resourceFilter);
  const deleteBook = useDeleteBook();
  const [addOpen, setAddOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrBook, setQrBook] = useState<{ id: string; title: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search title, author, ISBN..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Tabs value={resourceFilter} onValueChange={(v) => setResourceFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="physical">Physical</TabsTrigger>
            <TabsTrigger value="digital">Digital</TabsTrigger>
          </TabsList>
        </Tabs>
        <ViewToggle value={viewMode} onChange={setViewMode} />
        {canManage && (
          <>
            <Button variant="outline" className="gap-2" onClick={() => setScannerOpen(true)}>
              <QrCode size={16} /> Checkout / Return
            </Button>
            <Button className="btn-accent gap-2" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Add to Catalog
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : books.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No items in the catalog yet</CardContent></Card>
      ) : viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Title</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Author</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Copies / Access</th>
                    {canManage && <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium text-foreground">{book.title}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{book.author || '-'}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{book.category || '-'}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="gap-1">
                          {book.resource_type === 'digital' ? <FileText size={12} /> : <BookOpen size={12} />}
                          {book.resource_type === 'digital' ? 'Digital' : 'Physical'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {book.resource_type === 'digital' ? (
                          <Button size="sm" variant="link" className="h-auto p-0 gap-1" asChild>
                            <a href={book.file_url || '#'} target="_blank" rel="noopener noreferrer">
                              Open <ExternalLink size={12} />
                            </a>
                          </Button>
                        ) : (
                          <Badge variant={(book.available_copies || 0) > 0 ? 'secondary' : 'outline'}>
                            {book.available_copies}/{book.total_copies}
                          </Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            {book.resource_type === 'physical' && (
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setQrBook({ id: book.id, title: book.title })}>
                                <QrCode size={13} /> QR
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteBook.mutate(book.id)}>
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Card key={book.id}>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium leading-tight">{book.title}</p>
                    {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
                  </div>
                  {book.resource_type === 'digital' ? (
                    <Badge variant="outline" className="shrink-0 gap-1"><FileText size={12} /> Digital</Badge>
                  ) : (
                    <Badge variant={(book.available_copies || 0) > 0 ? 'secondary' : 'outline'} className="shrink-0">
                      {book.available_copies}/{book.total_copies}
                    </Badge>
                  )}
                </div>
                {book.category && <p className="text-xs text-muted-foreground">{book.category}</p>}
                <div className="flex gap-2 pt-1">
                  {book.resource_type === 'digital' && (
                    <Button size="sm" variant="outline" className="gap-1.5" asChild>
                      <a href={book.file_url || '#'} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={13} /> Open
                      </a>
                    </Button>
                  )}
                  {canManage && (
                    <>
                      {book.resource_type === 'physical' && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setQrBook({ id: book.id, title: book.title })}>
                          <QrCode size={13} /> Print QR
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteBook.mutate(book.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddBookDialog open={addOpen} onOpenChange={setAddOpen} />
      <LibraryScanner open={scannerOpen} onOpenChange={setScannerOpen} />
      {qrBook && <BookQRDialog book={qrBook} open={!!qrBook} onOpenChange={(o) => !o && setQrBook(null)} />}
    </div>
  );
}

function AddBookDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const addBook = useAddBook();
  const [form, setForm] = useState({
    title: '', author: '', isbn: '', category: '',
    resource_type: 'physical' as 'physical' | 'digital',
    total_copies: '1',
    file_url: '',
  });

  const isValid = form.title.trim() && (form.resource_type === 'physical' || form.file_url.trim());

  const handleAdd = async () => {
    if (!isValid) return;
    await addBook.mutateAsync({
      title: form.title.trim(),
      author: form.author.trim() || undefined,
      isbn: form.isbn.trim() || undefined,
      category: form.category.trim() || undefined,
      resource_type: form.resource_type,
      total_copies: form.resource_type === 'physical' ? Math.max(1, parseInt(form.total_copies, 10) || 1) : undefined,
      file_url: form.resource_type === 'digital' ? form.file_url.trim() : undefined,
    });
    setForm({ title: '', author: '', isbn: '', category: '', resource_type: 'physical', total_copies: '1', file_url: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to Catalog</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <RadioGroup
              value={form.resource_type}
              onValueChange={(v) => setForm({ ...form, resource_type: v as 'physical' | 'digital' })}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="physical" id="type-physical" />
                <Label htmlFor="type-physical" className="font-normal cursor-pointer">Physical</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="digital" id="type-digital" />
                <Label htmlFor="type-digital" className="font-normal cursor-pointer">Digital</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Author</Label>
              <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>ISBN</Label>
              <Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            {form.resource_type === 'physical' ? (
              <div className="space-y-1.5">
                <Label>Copies</Label>
                <Input type="number" min={1} value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} />
              </div>
            ) : null}
          </div>
          {form.resource_type === 'digital' && (
            <div className="space-y-1.5">
              <Label>File / Resource URL</Label>
              <Input
                value={form.file_url}
                onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">Where students/staff open or download this resource. No copy limit — anyone can access it anytime.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={addBook.isPending || !isValid}>
            {addBook.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
            Add to Catalog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoansTab() {
  const { data: loans = [], isLoading } = useLibraryLoans();
  const overdueCount = loans.filter(isLoanOverdue).length;

  return (
    <div className="space-y-4">
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 text-destructive p-3 text-sm">
          <AlertTriangle size={16} />
          {overdueCount} loan{overdueCount !== 1 ? 's are' : ' is'} overdue
        </div>
      )}
      {isLoading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : loans.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No loans yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {loans.map((loan) => <LoanRow key={loan.id} loan={loan} />)}
        </div>
      )}
    </div>
  );
}

function MyLoansTab() {
  const { data: loans = [], isLoading } = useMyLibraryLoans();

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (loans.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">You haven't borrowed any books yet</CardContent></Card>;

  return (
    <div className="space-y-2">
      {loans.map((loan) => <LoanRow key={loan.id} loan={loan} showBorrower={false} />)}
    </div>
  );
}

function LoanRow({ loan, showBorrower = true }: { loan: LibraryLoan; showBorrower?: boolean }) {
  const overdue = isLoanOverdue(loan);
  const borrowerName = loan.student
    ? `${loan.student.first_name} ${loan.student.last_name}`
    : loan.staff ? `${loan.staff.first_name} ${loan.staff.last_name}` : null;

  return (
    <Card className={overdue ? 'border-destructive/40' : undefined}>
      <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-medium text-sm">{loan.book?.title || 'Unknown book'}</p>
          {showBorrower && borrowerName && <p className="text-xs text-muted-foreground">{borrowerName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Due {loan.due_date}</span>
          {loan.returned_at ? (
            <Badge variant="secondary">Returned</Badge>
          ) : overdue ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : (
            <Badge variant="outline">Active</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolId } from './useSchoolId';
import { useMyStaffId } from './useMyStaffId';
import { toast } from 'sonner';

export interface LibraryBook {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  resource_type: 'physical' | 'digital';
  file_url: string | null;
  total_copies: number | null;
  available_copies: number | null;
  created_at: string;
}

export interface LibraryLoan {
  id: string;
  book_id: string;
  student_id: string | null;
  staff_id: string | null;
  issued_by: string | null;
  borrowed_at: string;
  due_date: string;
  returned_at: string | null;
  book?: { title: string; author: string | null } | null;
  student?: { first_name: string; last_name: string; admission_number: string } | null;
  staff?: { first_name: string; last_name: string; employee_id: string } | null;
}

export function useIsLibrarian() {
  const { user } = useAuth();
  const { data: myStaffId } = useMyStaffId();
  const isAdmin = user?.role === 'admin' || user?.role === 'principal';

  const query = useQuery({
    queryKey: ['is-librarian', myStaffId],
    queryFn: async (): Promise<boolean> => {
      if (!myStaffId) return false;
      const { data, error } = await supabase
        .from('special_roles' as any)
        .select('id')
        .eq('staff_id', myStaffId)
        .eq('role_type', 'librarian')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!myStaffId && !isAdmin,
  });

  return isAdmin || !!query.data;
}

export function useLibraryBooks(search?: string) {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['library-books', schoolId, search],
    queryFn: async (): Promise<LibraryBook[]> => {
      let query = supabase.from('library_books' as any).select('*').order('title');
      if (search) query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%,isbn.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as LibraryBook[];
    },
    enabled: !!schoolId,
  });
}

export function useAddBook() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (book: {
      title: string; author?: string; isbn?: string; category?: string;
      resource_type: 'physical' | 'digital';
      total_copies?: number;
      file_url?: string;
    }) => {
      const payload = book.resource_type === 'digital'
        ? { title: book.title, author: book.author, isbn: book.isbn, category: book.category, resource_type: 'digital', file_url: book.file_url, added_by: user?.id }
        : { title: book.title, author: book.author, isbn: book.isbn, category: book.category, resource_type: 'physical', total_copies: book.total_copies, available_copies: book.total_copies, added_by: user?.id };

      const { data, error } = await supabase
        .from('library_books' as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      try {
        await supabase.from('audit_log' as any).insert({
          user_id: user?.id, user_name: user?.name || null, action: 'add_book',
          entity_type: 'library', entity_id: (data as any)?.id, details: { title: book.title, resource_type: book.resource_type },
        });
      } catch {}
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] });
      toast.success('Added to catalog');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to add'),
  });
}

export function useUpdateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LibraryBook> & { id: string }) => {
      const { error } = await supabase.from('library_books' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] });
      toast.success('Book updated');
    },
    onError: (err: any) => toast.error(err.message),
  });
}

export function useDeleteBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('library_books' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] });
      toast.success('Book removed');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to remove — it may still have active loans'),
  });
}

/** Every active + returned loan for the school — librarian/admin view. */
export function useLibraryLoans() {
  const schoolId = useSchoolId();
  return useQuery({
    queryKey: ['library-loans', schoolId],
    queryFn: async (): Promise<LibraryLoan[]> => {
      const { data, error } = await supabase
        .from('library_loans' as any)
        .select(`
          id, book_id, student_id, staff_id, issued_by, borrowed_at, due_date, returned_at,
          book:book_id(title, author),
          student:student_id(first_name, last_name, admission_number),
          staff:staff_id(first_name, last_name, employee_id)
        `)
        .order('borrowed_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LibraryLoan[];
    },
    enabled: !!schoolId,
  });
}

/** The current user's own borrowing history — student or staff self-view. */
export function useMyLibraryLoans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-library-loans', user?.id],
    queryFn: async (): Promise<LibraryLoan[]> => {
      const { data, error } = await supabase
        .from('library_loans' as any)
        .select(`
          id, book_id, student_id, staff_id, borrowed_at, due_date, returned_at,
          book:book_id(title, author)
        `)
        .order('borrowed_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LibraryLoan[];
    },
    enabled: !!user?.id,
  });
}

export function isLoanOverdue(loan: { due_date: string; returned_at: string | null }) {
  return !loan.returned_at && new Date(loan.due_date) < new Date(new Date().toDateString());
}

export function useCheckoutBook() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: myStaffId } = useMyStaffId();

  return useMutation({
    mutationFn: async (payload: { book_id: string; student_id?: string; staff_id?: string; due_date: string }) => {
      const { data, error } = await supabase
        .from('library_loans' as any)
        .insert({ ...payload, issued_by: myStaffId })
        .select()
        .single();
      if (error) throw error;

      try {
        await supabase.from('audit_log' as any).insert({
          user_id: user?.id, user_name: user?.name || null, action: 'checkout',
          entity_type: 'library', entity_id: (data as any)?.id,
          details: { book_id: payload.book_id, student_id: payload.student_id, staff_id: payload.staff_id },
        });
      } catch {}
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] });
      queryClient.invalidateQueries({ queryKey: ['library-loans'] });
      toast.success('Book checked out');
    },
    onError: (err: any) => toast.error(err.message || 'Checkout failed — no copies may be available'),
  });
}

export function useReturnBook() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (loanId: string) => {
      const { error } = await supabase
        .from('library_loans' as any)
        .update({ returned_at: new Date().toISOString() })
        .eq('id', loanId);
      if (error) throw error;

      try {
        await supabase.from('audit_log' as any).insert({
          user_id: user?.id, user_name: user?.name || null, action: 'return',
          entity_type: 'library', entity_id: loanId,
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-books'] });
      queryClient.invalidateQueries({ queryKey: ['library-loans'] });
      toast.success('Book returned');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to mark as returned'),
  });
}

-- Batch 7 (#12): Library — physical catalog + borrow ledger
--
-- Recorded requirements: (1) librarian is a teacher-role-with-badge, not a
-- separate account type — reuses the existing special_roles 'librarian'
-- role_type rather than introducing a new permission or account type,
-- (2) checkout supports library-generated QR codes stuck on physical books,
-- ISBN/barcode lookup, AND scanning the borrower's existing student/staff ID
-- QR (no new borrower-side QR needed — reuses the STU:/STAFF: codes already
-- in use for attendance), (3) school-scoped, (4) overdue = flagged status +
-- in-app reminder, (5) physical catalog first (e-library/digital resources
-- deferred).

CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  author text,
  isbn text,
  category text,
  total_copies integer NOT NULL DEFAULT 1,
  available_copies integer NOT NULL DEFAULT 1,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_copies >= 0 AND available_copies <= total_copies)
);
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES public.staff(id),
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  due_date date NOT NULL,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((student_id IS NOT NULL AND staff_id IS NULL) OR (student_id IS NULL AND staff_id IS NOT NULL))
);
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;

-- Librarian = the existing special_roles badge, not a new permission or
-- account type, per the recorded requirement.
CREATE OR REPLACE FUNCTION public.is_librarian(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.special_roles sr
    JOIN public.staff s ON s.id = sr.staff_id
    WHERE s.user_id = _user_id AND sr.role_type = 'librarian' AND sr.is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_library(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'principal') OR public.is_librarian(_user_id)
$$;

-- Keeps available_copies correct regardless of which client path issued the
-- change, rather than trusting the app to decrement/increment it manually.
CREATE OR REPLACE FUNCTION public.apply_library_loan_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.library_books SET available_copies = available_copies - 1 WHERE id = NEW.book_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
    UPDATE public.library_books SET available_copies = available_copies + 1 WHERE id = NEW.book_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_library_loan_change
  AFTER INSERT OR UPDATE ON public.library_loans
  FOR EACH ROW EXECUTE FUNCTION public.apply_library_loan_change();

-- Catalog: any staff can browse; managing it (add/edit/remove books) is
-- admin/principal/librarian-badge only.
CREATE POLICY "Staff view school library catalog" ON public.library_books
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) AND public.same_school(school_id));

CREATE POLICY "Librarians manage school library catalog" ON public.library_books
  FOR ALL TO authenticated
  USING (public.can_manage_library(auth.uid()) AND public.same_school(school_id))
  WITH CHECK (public.can_manage_library(auth.uid()) AND public.same_school(school_id));

-- Loans: librarians/admins see and manage everything for the school; a
-- borrower can see their own loan history.
CREATE POLICY "Librarians view school loans" ON public.library_loans
  FOR SELECT TO authenticated
  USING (
    (public.can_manage_library(auth.uid()) AND public.same_school(school_id))
    OR EXISTS (SELECT 1 FROM public.students st WHERE st.id = student_id AND st.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.staff sf WHERE sf.id = staff_id AND sf.user_id = auth.uid())
  );

CREATE POLICY "Librarians manage school loans" ON public.library_loans
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_library(auth.uid()) AND public.same_school(school_id));

CREATE POLICY "Librarians update school loans" ON public.library_loans
  FOR UPDATE TO authenticated
  USING (public.can_manage_library(auth.uid()) AND public.same_school(school_id))
  WITH CHECK (public.same_school(school_id));

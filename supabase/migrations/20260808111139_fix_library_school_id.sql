-- Fix #20: RLS violation on library "add book"
--
-- Root cause: library_books and library_loans were created (Batch 7 / #12)
-- without ever being added to the autofill_school_id trigger list that most
-- other tables in this schema use. useAddBook/useCheckoutBook never set
-- school_id client-side either (matching the convention that the trigger is
-- supposed to fill it in), so every insert left school_id NULL — which then
-- failed the "same_school(school_id)" check in the RLS WITH CHECK clause,
-- surfacing as an RLS violation toast. Same bug would affect checkout
-- (useCheckoutBook), not just adding a book — neither table had the trigger.
--
-- No new CASE branch is needed in autofill_school_id() itself: the existing
-- generic fallback (the acting user's own school, via get_user_school_id)
-- is exactly correct here — a librarian/admin only ever adds books or
-- processes loans within their own school.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['library_books', 'library_loans'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.autofill_school_id()',
      t
    );
  END LOOP;
END $$;

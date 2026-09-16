-- Library was physical-only: library_books has no concept of a digital
-- resource, only a copy-count model (total_copies/available_copies) that
-- only makes sense for something with a finite number of physical items
-- to lend out. Adds a resource_type distinction; digital resources skip
-- the copy-count/checkout-loan model entirely (unlimited concurrent
-- access via file_url) rather than being forced through a due-date/return
-- cycle that doesn't apply to them.

ALTER TABLE public.library_books
  ADD COLUMN resource_type text NOT NULL DEFAULT 'physical'
    CHECK (resource_type IN ('physical', 'digital')),
  ADD COLUMN file_url text;

-- Copy counts are meaningless for a digital resource — relax so they can
-- be left null there, while every existing (and future physical) row
-- keeps them required via the branching check below.
ALTER TABLE public.library_books
  ALTER COLUMN total_copies DROP NOT NULL,
  ALTER COLUMN available_copies DROP NOT NULL;

ALTER TABLE public.library_books
  ADD CONSTRAINT chk_library_resource_fields CHECK (
    (resource_type = 'physical' AND total_copies IS NOT NULL AND available_copies IS NOT NULL)
    OR
    (resource_type = 'digital' AND file_url IS NOT NULL)
  );

-- library_loans (the checkout/due-date/return cycle) stays physical-only
-- by construction — nothing here changes it, and the existing
-- adjust_available_copies trigger only ever fires from a loan row, which
-- a digital resource never has one of. This guard makes that explicit
-- rather than relying on the UI alone to keep a digital resource out of
-- the loan flow (its NULL copy count would otherwise silently accept a
-- checkout without ever correctly tracking it).
CREATE OR REPLACE FUNCTION public.guard_physical_only_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resource_type text;
BEGIN
  SELECT resource_type INTO v_resource_type FROM public.library_books WHERE id = NEW.book_id;
  IF v_resource_type = 'digital' THEN
    RAISE EXCEPTION 'Digital resources are opened directly and cannot be checked out';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_physical_only_loan ON public.library_loans;
CREATE TRIGGER trg_guard_physical_only_loan
  BEFORE INSERT ON public.library_loans
  FOR EACH ROW EXECUTE FUNCTION public.guard_physical_only_loan();


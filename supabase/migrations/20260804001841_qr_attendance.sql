-- Batch 5 (#3, part 1): QR attendance completion
--
-- Two gaps found while wiring up the QR flows requested this session:
--
-- 1. Student QR scanning (QRAttendanceScanner.tsx, type 'STU') already existed and
--    matches "staff scans student ID card QR" — but Batch 3's form-teacher-only
--    attendance_records INSERT policy would now block any staff member who isn't
--    the scanned student's form teacher from using it. A QR gate/checkpoint is
--    inherently operated by whichever staff member is stationed there, not
--    necessarily that student's form teacher, so QR-origin inserts get their own
--    carve-out (open to any staff of the school) while manual entry stays
--    form-teacher-scoped exactly as Batch 3 left it.
--
-- 2. Staff self-scan ("staff scans an admin-provided QR code") has no consumer at
--    all yet — Settings already prints a 'CLOCK:STAFF' QR code, but nothing
--    recognizes that value on scan. staff_clock_records RLS already permits a
--    staff member to write their own record (or any staff's, for the existing
--    admin-scans-badge mode), so no RLS change is needed there — only the
--    'CLOCK:STAFF:<school_id>' value shape (school_id added for tenant-safety,
--    matching the STU:/STAFF: pattern) and a client-side consumer, built
--    separately from this migration.

-- Distinguish how an attendance_records row was created, so RLS can treat QR-gate
-- scans (broader access) differently from manual per-class marking (form-teacher-
-- scoped, per Batch 3).
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'manual';

ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_method_check;
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_method_check CHECK (method IN ('manual', 'qr'));

-- The existing UNIQUE (student_id, date, period) constraint doesn't stop duplicate
-- *daily* (period IS NULL) rows, since Postgres treats NULLs as distinct in unique
-- constraints. QR scanning makes accidental double-marking more likely (two gate
-- staff, or a re-scan), so add the missing partial-unique guard for that case.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_daily_unique
  ON public.attendance_records (student_id, date)
  WHERE period IS NULL;

-- Duplicate-check used by the QR scanner before inserting. A plain SELECT would
-- need attendance_records read access broadened back out for QR-scanning staff,
-- which would undo Batch 3's viewing scope — this narrow SECURITY DEFINER function
-- returns only a yes/no instead, regardless of who originally marked the row.
CREATE OR REPLACE FUNCTION public.attendance_already_marked(_student_id uuid, _date date, _period integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.attendance_records ar
    JOIN public.students s ON s.id = ar.student_id
    WHERE ar.student_id = _student_id
      AND ar.date = _date
      AND (
        (_period IS NULL AND ar.period IS NULL)
        OR ar.period = _period
      )
      AND public.same_school(s.school_id)
      AND public.is_staff(auth.uid())
  )
$$;

-- Replace Batch 3's INSERT policy with one that adds the QR carve-out; manual
-- inserts keep exactly the same form-teacher scoping as before.
DROP POLICY IF EXISTS "Form teachers and admins insert attendance records" ON public.attendance_records;
CREATE POLICY "Form teachers, admins and QR scans insert attendance records"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    public.same_school(school_id)
    AND (
      session_id IS NULL
      OR NOT public.attendance_session_locked(session_id)
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'principal')
    )
    AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal')
      OR (method = 'qr' AND public.is_staff(auth.uid()))
      OR (
        method = 'manual' AND public.has_role(auth.uid(), 'teacher')
        AND public.is_form_teacher_of_class(public.attendance_record_class_id(session_id, student_id))
      )
    )
  );

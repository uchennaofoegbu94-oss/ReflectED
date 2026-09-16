-- Edit list #4: self-signups need review before they get real access —
-- students/teachers by that school's admin/principal, admins/principals by
-- a super-admin — with the ability to change the account type before
-- approving (e.g. someone who picked "Principal" by mistake).
--
-- Finding while investigating: there was no review step of any kind.
-- Login.tsx's public signup form lets anyone who knows a valid school code
-- pick ANY role — including Administrator or Principal — and
-- handle_new_user() grants full access immediately. That's not just a
-- missing feature, it's an open privilege-escalation path: nothing stopped
-- self-registering as an admin of any school whose code you had.
--
-- Fix: approval_status on user_roles, defaulting to 'approved' for every
-- existing row and for accounts an admin/staff-invite/super-admin already
-- created (so nothing already trusted gets locked out), 'pending' only for
-- a brand-new public self-signup. has_role()/is_staff() — the two
-- functions nearly every RLS policy in the app is built on — now also
-- require 'approved', so a pending account is functionally inert
-- everywhere at once rather than needing per-table gating.

ALTER TABLE public.user_roles
  ADD COLUMN approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- has_role() is the single choke point ~140 RLS policies already go
-- through — adding the approval check here, once, closes the gap
-- everywhere those policies apply instead of touching each of them.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND approval_status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'principal', 'teacher', 'accountant')
    AND approval_status = 'approved'
  )
$$;

-- handle_new_user(): a self-signup (the public Login.tsx form, via
-- supabase.auth.signUp()) starts 'pending'. An account created by an
-- edge function on someone's behalf (invite-staff-member,
-- create-student-account, create-school-with-admin — see the accompanying
-- edge function changes for the pre_approved flag they now set) was
-- already vetted by whoever created it, so it's approved immediately —
-- same as every pre-existing row, via the column's own default above.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_role text;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_middle_name text;
  v_name_parts text[];
  v_pre_approved boolean;
  v_approval_status text;
BEGIN
  v_school_id := (NEW.raw_user_meta_data ->> 'school_id')::uuid;
  v_role := NEW.raw_user_meta_data ->> 'role';
  v_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email);
  v_pre_approved := COALESCE((NEW.raw_user_meta_data ->> 'pre_approved')::boolean, false);
  v_approval_status := CASE WHEN v_pre_approved THEN 'approved' ELSE 'pending' END;

  INSERT INTO public.profiles (user_id, full_name, email, school_id)
  VALUES (NEW.id, v_full_name, NEW.email, v_school_id);

  IF v_role IS NULL OR v_school_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role, school_id, approval_status)
  VALUES (NEW.id, v_role::public.app_role, v_school_id, v_approval_status)
  ON CONFLICT DO NOTHING;

  v_name_parts := regexp_split_to_array(trim(v_full_name), '\s+');
  v_first_name := COALESCE(v_name_parts[1], 'Unknown');
  v_last_name := CASE WHEN array_length(v_name_parts, 1) > 1 THEN v_name_parts[array_length(v_name_parts, 1)] ELSE '' END;
  v_middle_name := CASE WHEN array_length(v_name_parts, 1) > 2
    THEN array_to_string(v_name_parts[2:array_length(v_name_parts, 1) - 1], ' ')
    ELSE NULL END;

  -- The profile record (students/staff row) is still created right away
  -- even while pending — it's just data, and it's what a reviewer looks
  -- at to approve/reassign. Nothing functional opens up from its
  -- existence alone; every RLS-gated action still goes through
  -- has_role()/is_staff() above.
  IF v_role IN ('teacher', 'principal', 'admin', 'accountant') THEN
    INSERT INTO public.staff (
      user_id, employee_id, first_name, last_name, middle_name, email, gender, school_id
    ) VALUES (
      NEW.id,
      'EMP-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4),
      v_first_name, v_last_name, v_middle_name, NEW.email, 'male', v_school_id
    );
  ELSIF v_role = 'student' THEN
    INSERT INTO public.students (
      user_id, admission_number, first_name, last_name, middle_name, gender, school_id
    ) VALUES (
      NEW.id,
      'STU-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4),
      v_first_name, v_last_name, v_middle_name, 'male', v_school_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Lets an admin/principal (their own school's students/teachers/
-- accountants) or a super-admin (anyone, and required for admin/principal
-- signups specifically) approve, reject, or reassign-then-approve a
-- pending signup. SECURITY DEFINER so it can move the profile row between
-- students/staff when the account type changes across that boundary,
-- inside one transaction, with its own authorization check rather than
-- relying on table-level RLS for that decision.
CREATE OR REPLACE FUNCTION public.review_signup(
  _target_user_id uuid,
  _decision text,
  _new_role app_role DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role app_role;
  v_target_school_id uuid;
  v_final_role app_role;
  v_is_super_admin boolean;
BEGIN
  SELECT role, school_id INTO v_current_role, v_target_school_id
  FROM public.user_roles WHERE user_id = _target_user_id;

  IF v_current_role IS NULL THEN
    RAISE EXCEPTION 'No signup found for this user';
  END IF;

  v_final_role := COALESCE(_new_role, v_current_role);
  SELECT EXISTS(SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()) INTO v_is_super_admin;

  IF v_final_role IN ('admin', 'principal') OR v_current_role IN ('admin', 'principal') THEN
    IF NOT v_is_super_admin THEN
      RAISE EXCEPTION 'Only a super-admin can review an admin or principal signup';
    END IF;
  ELSIF NOT (
    v_is_super_admin
    OR (
      public.same_school(v_target_school_id)
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to review this signup';
  END IF;

  IF _decision = 'reject' THEN
    UPDATE public.user_roles SET approval_status = 'rejected' WHERE user_id = _target_user_id;
    RETURN;
  ELSIF _decision != 'approve' THEN
    RAISE EXCEPTION 'Invalid decision: %', _decision;
  END IF;

  -- Account type changed across the student/staff boundary — move the
  -- profile row rather than leaving a stale one of the wrong kind behind.
  IF v_final_role != v_current_role THEN
    IF v_current_role = 'student' AND v_final_role IN ('teacher', 'principal', 'admin', 'accountant') THEN
      INSERT INTO public.staff (user_id, employee_id, first_name, last_name, middle_name, email, gender, school_id)
      SELECT s.user_id,
             'EMP-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4),
             s.first_name, s.last_name, s.middle_name,
             COALESCE(p.email, ''), s.gender::text, s.school_id
      FROM public.students s
      LEFT JOIN public.profiles p ON p.user_id = s.user_id
      WHERE s.user_id = _target_user_id;
      DELETE FROM public.students WHERE user_id = _target_user_id;
    ELSIF v_current_role IN ('teacher', 'principal', 'admin', 'accountant') AND v_final_role = 'student' THEN
      INSERT INTO public.students (user_id, admission_number, first_name, last_name, middle_name, gender, school_id)
      SELECT st.user_id,
             'STU-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4),
             st.first_name, st.last_name, st.middle_name,
             CASE WHEN st.gender = 'female' THEN 'female' ELSE 'male' END::gender_type,
             st.school_id
      FROM public.staff st
      WHERE st.user_id = _target_user_id;
      DELETE FROM public.staff WHERE user_id = _target_user_id;
    END IF;
    -- A change within the staff roles (e.g. teacher -> accountant) needs
    -- no table move — both already live in `staff`.
  END IF;

  UPDATE public.user_roles SET role = v_final_role, approval_status = 'approved'
  WHERE user_id = _target_user_id;
END;
$$;

-- So a reviewer can actually see what's waiting on them — scoped to
-- pending rows only, and to the reviewer's own school for admin/
-- principal (a super-admin sees every school's via the separate clause).
CREATE POLICY "Reviewers view pending signups" ON public.user_roles FOR SELECT TO authenticated
  USING (
    approval_status = 'pending' AND (
      EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
      OR (
        public.same_school(school_id)
        AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'principal'))
        AND role NOT IN ('admin', 'principal')
      )
    )
  );

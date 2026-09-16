-- Fix for item 3 (signup review workflow): a pending self-signup's
-- staff/students row was still being created immediately by
-- handle_new_user(), same as always. approval_status blocked *functional*
-- access (has_role()/is_staff()), but nothing blocked *visibility* — every
-- staff/student list in the app queries the staff/students table directly
-- with no approval filter (useStaff(), useStudents(), etc.), so a pending
-- signup showed up in Teachers/Students immediately, looking exactly like
-- an approved one. That's the bug: "moves straight to teachers table."
--
-- Fix: a self-signup (not pre_approved) no longer gets a staff/students
-- row at signup time at all — only profiles + a pending user_roles row.
-- The row is created for the first time inside review_signup(), using
-- whatever role the admin/principal/super-admin actually approves —
-- making that choice the one that actually specifies the account type,
-- not just a relabeling of a row that already existed under the
-- self-picked one.

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

  -- A pending self-signup gets no staff/students row yet — see
  -- review_signup() below, which creates it once actually approved, using
  -- whichever role the reviewer settles on. Skipping this here is what
  -- keeps a pending signup out of every staff/student list in the app
  -- (Teachers, Students, etc. all query those tables directly).
  IF v_approval_status != 'approved' THEN
    RETURN NEW;
  END IF;

  v_name_parts := regexp_split_to_array(trim(v_full_name), '\s+');
  v_first_name := COALESCE(v_name_parts[1], 'Unknown');
  v_last_name := CASE WHEN array_length(v_name_parts, 1) > 1 THEN v_name_parts[array_length(v_name_parts, 1)] ELSE '' END;
  v_middle_name := CASE WHEN array_length(v_name_parts, 1) > 2
    THEN array_to_string(v_name_parts[2:array_length(v_name_parts, 1) - 1], ' ')
    ELSE NULL END;

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

-- review_signup(): now handles two cases instead of one — a row that
-- already exists (the old "reassign an already-created account" path,
-- still relevant for any signup that predates this fix) and, now the
-- common case, no row existing yet at all (a fresh self-signup), which
-- creates one for the first time under the approved role.
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
  v_full_name text;
  v_email text;
  v_first_name text;
  v_last_name text;
  v_middle_name text;
  v_name_parts text[];
  v_has_staff_row boolean;
  v_has_student_row boolean;
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

  SELECT EXISTS(SELECT 1 FROM public.staff WHERE user_id = _target_user_id) INTO v_has_staff_row;
  SELECT EXISTS(SELECT 1 FROM public.students WHERE user_id = _target_user_id) INTO v_has_student_row;

  IF NOT v_has_staff_row AND NOT v_has_student_row THEN
    -- Fresh self-signup — no profile record exists under any role yet.
    -- Create one now, for the first time, under whatever role is being
    -- approved (the admin's own pick if reassigned, or the self-picked
    -- one if left as-is) — this is what makes the approval step the one
    -- that actually specifies the account type.
    SELECT full_name, email INTO v_full_name, v_email FROM public.profiles WHERE user_id = _target_user_id;
    v_full_name := COALESCE(v_full_name, v_email, 'Unknown');
    v_name_parts := regexp_split_to_array(trim(v_full_name), '\s+');
    v_first_name := COALESCE(v_name_parts[1], 'Unknown');
    v_last_name := CASE WHEN array_length(v_name_parts, 1) > 1 THEN v_name_parts[array_length(v_name_parts, 1)] ELSE '' END;
    v_middle_name := CASE WHEN array_length(v_name_parts, 1) > 2
      THEN array_to_string(v_name_parts[2:array_length(v_name_parts, 1) - 1], ' ')
      ELSE NULL END;

    IF v_final_role IN ('teacher', 'principal', 'admin', 'accountant') THEN
      INSERT INTO public.staff (user_id, employee_id, first_name, last_name, middle_name, email, gender, school_id)
      VALUES (
        _target_user_id,
        'EMP-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4),
        v_first_name, v_last_name, v_middle_name, COALESCE(v_email, ''), 'male', v_target_school_id
      );
    ELSIF v_final_role = 'student' THEN
      INSERT INTO public.students (user_id, admission_number, first_name, last_name, middle_name, gender, school_id)
      VALUES (
        _target_user_id,
        'STU-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4),
        v_first_name, v_last_name, v_middle_name, 'male', v_target_school_id
      );
    END IF;
    -- 'parent' has no profile table of its own in this schema — nothing
    -- further to create for that role.

  ELSIF v_final_role != v_current_role THEN
    -- A row already exists (a signup from before this fix, or a rare
    -- re-review) and the role is being changed across the student/staff
    -- boundary — move it rather than leaving a stale one behind.
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
  END IF;

  UPDATE public.user_roles SET role = v_final_role, approval_status = 'approved'
  WHERE user_id = _target_user_id;
END;
$$;

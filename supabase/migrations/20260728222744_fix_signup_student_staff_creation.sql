-- Bug: a student signing up with a valid school code never got a row
-- in `students`. Root cause: handle_new_user() only ever created a
-- `profiles` row — the `students`/`staff` rows were created by a
-- separate client-side insert AFTER signup, in AuthContext.tsx. But
-- the only INSERT policy on `students` requires is_staff(auth.uid()),
-- which is false for a brand-new self-registering student — so that
-- insert was always silently rejected by RLS for students (and would
-- have been equally fragile for staff, depending on session timing
-- right after signUp()).
--
-- Fix: do it all inside the trigger. SECURITY DEFINER bypasses RLS
-- entirely and runs atomically with the auth.users insert, so there's
-- no dependency on the client's session being fully established yet.
-- The client no longer needs to (and should stop trying to) insert
-- these rows itself — see the accompanying AuthContext.tsx change.

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
BEGIN
  v_school_id := (NEW.raw_user_meta_data ->> 'school_id')::uuid;
  v_role := NEW.raw_user_meta_data ->> 'role';
  v_full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email);

  INSERT INTO public.profiles (user_id, full_name, email, school_id)
  VALUES (NEW.id, v_full_name, NEW.email, v_school_id);

  -- No role provided (e.g. the super-admin seed path, which manages
  -- its own role assignment separately) — nothing further to do.
  IF v_role IS NULL OR v_school_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_roles (user_id, role, school_id)
  VALUES (NEW.id, v_role::public.app_role, v_school_id)
  ON CONFLICT DO NOTHING;

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

-- Trigger itself is unchanged (still AFTER INSERT ON auth.users), only
-- the function body above changed — CREATE OR REPLACE takes effect
-- immediately without needing to touch the trigger definition.

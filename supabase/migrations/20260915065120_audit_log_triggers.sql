-- Investigated audit_log: useLogAction (client hook) is never actually
-- called anywhere in the app, and no DB trigger wrote to audit_log either
-- — only create-student-account (one edge function, one action type) did.
-- In practice the table was capturing almost nothing.
--
-- Fix: a generic, reusable trigger function attached to the sensitive
-- tables that matter (role/permission changes, student/staff records,
-- payments, school-level settings) instead of scattered, easily-forgotten
-- client-side calls. Deliberately NOT attached to high-frequency
-- system-internal writes (broadsheet_field_scores and its whole
-- propagate/recompute/push cascade from earlier this session) — logging
-- every automatic score recompute would multiply row volume enormously
-- and bury the actually-important events in noise. If specific graded-
-- entry auditing is wanted later, it should hook the human entry point
-- (e.g. AssignmentGradingDialog's save), not the cascade.
--
-- auth.uid() is only populated when the request carries the calling
-- user's own JWT (i.e. normal client-side writes through RLS). Edge
-- functions using the service-role key run outside that JWT context, so
-- writes they make (e.g. delete-user-account's own explicit audit_log
-- insert) aren't re-logged a second time here — this trigger simply
-- no-ops when there's no identifiable actor, rather than logging a
-- meaningless placeholder. That split (trigger for direct client writes,
-- explicit logging inside service-role edge functions) is intentional,
-- not a gap.

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_name text;
  v_new_json jsonb;
  v_old_json jsonb;
  v_entity_id uuid;
  v_school_id uuid;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Auditing must never be able to break the real operation it's
  -- observing — any failure here (including a missing profiles row) is
  -- swallowed rather than propagated.
  BEGIN
    v_new_json := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END;
    v_old_json := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END;

    v_entity_id := COALESCE((v_new_json->>'id')::uuid, (v_old_json->>'id')::uuid);
    -- Most audited tables have their own school_id column; the one that
    -- doesn't (schools itself) IS the school, so fall back to its own id.
    v_school_id := COALESCE(
      (v_new_json->>'school_id')::uuid, (v_old_json->>'school_id')::uuid,
      CASE WHEN TG_TABLE_NAME = 'schools' THEN v_entity_id END
    );

    SELECT COALESCE(p.full_name, p.email) INTO v_actor_name
    FROM public.profiles p WHERE p.user_id = v_actor_id;

    INSERT INTO public.audit_log (user_id, user_name, action, entity_type, entity_id, school_id, details)
    VALUES (
      v_actor_id,
      v_actor_name,
      TG_OP || '_' || TG_TABLE_NAME,
      TG_TABLE_NAME,
      v_entity_id,
      v_school_id,
      CASE
        WHEN TG_OP = 'DELETE' THEN jsonb_build_object('old', v_old_json)
        WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('old', v_old_json, 'new', v_new_json)
        ELSE jsonb_build_object('new', v_new_json)
      END
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Role assignment/removal — the single most security-relevant table.
DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Delegated-permission grant/revoke.
DROP TRIGGER IF EXISTS trg_audit_permission_grants ON public.permission_grants;
CREATE TRIGGER trg_audit_permission_grants
  AFTER INSERT OR DELETE ON public.permission_grants
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Special role (e.g. class teacher, exam officer) assignment.
DROP TRIGGER IF EXISTS trg_audit_special_roles ON public.special_roles;
CREATE TRIGGER trg_audit_special_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.special_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Student/staff record changes. DELETE intentionally excluded — that
-- path is now funneled exclusively through the delete-user-account edge
-- function (see 20260914... staff/student delete-cascade work earlier
-- this session), which already logs it explicitly; adding DELETE here
-- too would just double the row for every deletion.
DROP TRIGGER IF EXISTS trg_audit_students ON public.students;
CREATE TRIGGER trg_audit_students
  AFTER INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_staff ON public.staff;
CREATE TRIGGER trg_audit_staff
  AFTER INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Payment record changes (recording, editing, voiding a payment).
DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- School-level settings changes. INSERT/DELETE excluded — school
-- creation/deletion is a super-admin/tenant-provisioning action handled
-- by manage-school and create-school-with-admin, a separate scope.
DROP TRIGGER IF EXISTS trg_audit_schools ON public.schools;
CREATE TRIGGER trg_audit_schools
  AFTER UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_school_settings ON public.school_settings;
CREATE TRIGGER trg_audit_school_settings
  AFTER UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

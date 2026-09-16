import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Identify the caller via their own token (not the service role) so
    // we know who's actually asking, then check their privileges with
    // the service-role client. This never touches the caller's own
    // session — unlike calling supabase.auth.signUp() from the admin's
    // own browser tab, which silently swaps the active session over to
    // the newly created user.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", caller.id)
      .in("role", ["admin", "principal"]);

    let schoolId = callerRoles?.[0]?.school_id;
    let authorized = !!(callerRoles && callerRoles.length > 0);

    if (!authorized) {
      // Not admin/principal — check for a delegated manage_staff grant instead.
      const { data: staffRow } = await supabase
        .from("staff").select("id, school_id").eq("user_id", caller.id).maybeSingle();
      if (staffRow) {
        const { data: grant } = await supabase
          .from("permission_grants")
          .select("id")
          .eq("staff_id", staffRow.id)
          .eq("permission", "manage_staff")
          .maybeSingle();
        if (grant) {
          authorized = true;
          schoolId = staffRow.school_id;
        }
      }
    }

    if (!authorized) {
      return json({ error: "Only admins, principals, or staff with the manage_staff permission can add staff" }, 403);
    }

    const body = await req.json();
    const {
      email, password, full_name, role, employee_id, phone, gender, qualification,
      first_name, last_name, middle_name,
    } = body;

    if (!email || !password || !full_name || !role) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!["teacher", "accountant", "principal"].includes(role)) {
      return json({ error: "Invalid role for staff invitation" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // Create the auth user via the admin API. email_confirm: true means
    // the invited staff member can log in immediately with the password
    // the admin set, without needing to click a confirmation email —
    // reasonable for an admin-vouched-for account.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        school_id: schoolId,
        role,
        // Already vetted by the admin/principal who invited them — skip
        // the pending-review gate handle_new_user() applies to public
        // self-signups.
        pre_approved: true,
      },
    });

    if (authError) {
      return json({ error: authError.message }, 400);
    }
    const newUserId = authData.user!.id;

    // Staff invitation is exactly the kind of event an audit trail exists for —
    // who was added, by whom, in what role. Best-effort: a logging failure
    // shouldn't turn a successful invite into an error response.
    try {
      await supabase.from("audit_log").insert({
        user_id: caller.id,
        user_name: caller.email ?? null,
        action: "invite",
        entity_type: "staff",
        entity_id: newUserId,
        school_id: schoolId,
        details: { email, role, full_name },
      });
    } catch { /* non-fatal */ }

    // handle_new_user() already created profiles/user_roles/staff rows
    // from the metadata above. Fill in the extra fields the invite form
    // collects that the trigger doesn't know about (phone, employee_id
    // override, etc).
    const staffUpdate: Record<string, unknown> = {};
    if (employee_id) staffUpdate.employee_id = employee_id;
    if (phone) staffUpdate.phone = phone;
    if (gender) staffUpdate.gender = gender;
    if (qualification) staffUpdate.qualification = qualification;
    if (first_name) staffUpdate.first_name = first_name;
    if (last_name) staffUpdate.last_name = last_name;
    if (middle_name) staffUpdate.middle_name = middle_name;

    if (Object.keys(staffUpdate).length > 0) {
      const { error: updateErr } = await supabase
        .from("staff")
        .update(staffUpdate)
        .eq("user_id", newUserId);
      if (updateErr) {
        // The account and base staff record already exist at this
        // point — surface this as a partial-success, not a hard
        // failure that implies nothing happened.
        return json({
          warning: `Staff account created, but some fields failed to save: ${updateErr.message}`,
          userId: newUserId,
        }, 200);
      }
    }

    return json({ message: "Staff member added", userId: newUserId });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});

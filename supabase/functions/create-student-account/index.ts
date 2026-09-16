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

    // Same reasoning as invite-staff-member: identify the caller via their
    // own token, act with the service role, and never touch the caller's
    // own browser session. AddStudentDialog.tsx previously called
    // supabase.auth.signUp() directly from the admin's own tab, which
    // silently swaps the active session over to the newly created student
    // for a moment (surfacing as the wrong role/tag in the navbar) and
    // never passed school_id/role in the signup metadata at all — leaving
    // the student's profile without a school_id and the follow-up manual
    // user_roles insert failing (silently, only console.error'd) since it
    // didn't include school_id either. Net effect: "an empty student
    // account" with no working role or school scoping.
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

    if (!callerRoles || callerRoles.length === 0) {
      return json({ error: "Only admins or principals can add students" }, 403);
    }
    const schoolId = callerRoles[0].school_id;

    const body = await req.json();
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // email_confirm: true — an admin-vouched-for account can log in
    // immediately with the password the admin set.
    // role is deliberately omitted from metadata: handle_new_user() would
    // otherwise auto-create a placeholder students row from just a full
    // name, which the client then immediately overwrites anyway with the
    // real form data (gender, DOB, class, admission number) via
    // useCreateStudent — so user_roles is inserted explicitly below
    // instead, and the students row creation stays exactly where it
    // already was, client-side, unchanged.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, school_id: schoolId },
    });

    if (authError) {
      return json({ error: authError.message }, 400);
    }
    const newUserId = authData.user!.id;

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: newUserId, role: "student", school_id: schoolId });

    if (roleError) {
      // Don't leave an auth user with no role behind.
      await supabase.auth.admin.deleteUser(newUserId);
      return json({ error: `Failed to assign student role: ${roleError.message}` }, 500);
    }

    try {
      await supabase.from("audit_log").insert({
        user_id: caller.id,
        user_name: caller.email ?? null,
        action: "add_student_account",
        entity_type: "staff",
        entity_id: newUserId,
        school_id: schoolId,
        details: { email, full_name },
      });
    } catch { /* non-fatal */ }

    return json({ success: true, user_id: newUserId });
  } catch (err: any) {
    return json({ error: err.message || "Unexpected error" }, 500);
  }
});

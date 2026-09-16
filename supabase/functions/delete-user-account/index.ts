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

// Fixes a real gap: useDeleteStudent/useDeleteStaff previously only ran
// `DELETE FROM students|staff WHERE id = ...` from the client — removing
// the domain row (so the person disappeared from Students.tsx/Teachers.tsx)
// but leaving their auth.users account AND their user_roles row completely
// untouched. Net effect: a "deleted" student or staff member could still
// log in afterward with a working 'student'/'staff' role and a school_id,
// just pointing at nothing. This function deletes all three pieces
// together — domain row, user_roles, auth user — via the service role,
// mirroring create-student-account's approach to anything auth-related.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

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
      return json({ error: "Only admins or principals can delete accounts" }, 403);
    }
    const callerSchoolId = callerRoles[0].school_id;

    const body = await req.json();
    const { domain_table, domain_id } = body;
    if (domain_table !== "students" && domain_table !== "staff") {
      return json({ error: "domain_table must be 'students' or 'staff'" }, 400);
    }
    if (!domain_id) return json({ error: "domain_id is required" }, 400);

    // Look up the domain row first — need its user_id (may already be
    // null, e.g. a student whose auth account was separately removed
    // earlier) and confirm it belongs to the caller's own school before
    // touching anything.
    const { data: domainRow, error: fetchError } = await supabase
      .from(domain_table)
      .select("id, user_id, school_id")
      .eq("id", domain_id)
      .maybeSingle();

    if (fetchError) return json({ error: fetchError.message }, 500);
    if (!domainRow) return json({ error: "Record not found" }, 404);
    if (domainRow.school_id && domainRow.school_id !== callerSchoolId) {
      return json({ error: "Not authorized for this school" }, 403);
    }

    const targetUserId = domainRow.user_id as string | null;
    const errors: string[] = [];

    const { error: domainDeleteError } = await supabase
      .from(domain_table)
      .delete()
      .eq("id", domain_id);
    if (domainDeleteError) return json({ error: domainDeleteError.message }, 500);

    if (targetUserId) {
      const { error: roleDeleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId);
      if (roleDeleteError) errors.push(`user_roles: ${roleDeleteError.message}`);

      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(targetUserId);
      // "User not found" just means the auth account was already gone
      // (e.g. removed separately beforehand) — not a real failure here.
      if (authDeleteError && !/not.?found/i.test(authDeleteError.message)) {
        errors.push(`auth user: ${authDeleteError.message}`);
      }
    }

    try {
      await supabase.from("audit_log").insert({
        user_id: caller.id,
        user_name: caller.email ?? null,
        action: `delete_${domain_table.slice(0, -1)}_account`,
        entity_type: domain_table,
        entity_id: domain_id,
        school_id: callerSchoolId,
        details: { had_linked_user: !!targetUserId, partial_errors: errors.length ? errors : undefined },
      });
    } catch { /* non-fatal */ }

    // The domain row itself is gone regardless — surface any leftover
    // auth/role cleanup problems as a warning rather than pretending the
    // whole operation failed.
    if (errors.length > 0) {
      return json({ success: true, warning: `Record deleted, but some login cleanup failed: ${errors.join("; ")}` });
    }
    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message || "Unexpected error" }, 500);
  }
});

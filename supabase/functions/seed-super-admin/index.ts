import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─── Gate: this function provisions/rotates the super-admin account,
    // so it must never be callable by an anonymous request. Require a
    // shared secret set as a Supabase Edge Function secret, sent by the
    // caller as `x-seed-secret`. Never hardcode this value.
    const seedSecret = Deno.env.get("SEED_SECRET");
    if (!seedSecret) {
      return new Response(
        JSON.stringify({ error: "SEED_SECRET is not configured on the server" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    if (req.headers.get("x-seed-secret") !== seedSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // ─── Credentials come from env, never from source. No default value
    // is provided — the function fails closed if they're unset, rather
    // than silently falling back to something predictable.
    const ADMIN_EMAIL = Deno.env.get("SUPER_ADMIN_EMAIL");
    const ADMIN_PASSWORD = Deno.env.get("SUPER_ADMIN_PASSWORD");
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not configured on the server" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }
    if (ADMIN_PASSWORD.length < 12) {
      return new Response(
        JSON.stringify({ error: "SUPER_ADMIN_PASSWORD is too short (minimum 12 characters)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find existing user
    const { data: list } = await supabase.auth.admin.listUsers();
    let user = list?.users?.find((u: any) => u.email === ADMIN_EMAIL);

    if (!user) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Super Admin" },
      });
      if (createErr) throw createErr;
      user = created.user;
    } else {
      // Reset password & ensure email confirmed
      await supabase.auth.admin.updateUserById(user.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
    }

    // Ensure promoted to super_admin. Check the result explicitly — a
    // silently-failed upsert here is worse than a loud one: it leaves a
    // fully working login that the app's "not a platform administrator"
    // gate then rejects, which is confusing to debug from the outside.
    const { error: upsertErr } = await supabase
      .from("super_admins")
      .upsert({ user_id: user!.id }, { onConflict: "user_id" });
    if (upsertErr) {
      return new Response(
        JSON.stringify({
          error: `User created/updated, but promoting to super_admin failed: ${upsertErr.message}`,
          userId: user!.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Never echo the password back, even over HTTPS — the caller already
    // knows it since they had to supply SEED_SECRET to get here.
    return new Response(
      JSON.stringify({
        message: "Super admin ready",
        email: ADMIN_EMAIL,
        userId: user!.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      school_name,
      school_code,
      school_email,
      school_address,
      school_phone,
      admin_email,
      admin_password,
      admin_full_name,
      created_by, // optional: super admin user id
    } = body;

    if (!school_name || !school_code || !admin_email || !admin_password || !admin_full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check for duplicate school code
    const { data: existingSchool } = await supabase
      .from("schools")
      .select("id")
      .ilike("school_code", school_code)
      .limit(1);

    if (existingSchool && existingSchool.length > 0) {
      return new Response(
        JSON.stringify({ error: "A school with this code already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
      );
    }

    // 1. Create the school
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .insert({
        name: school_name,
        school_code: school_code.toUpperCase(),
        email: school_email || null,
        address: school_address || null,
        phone: school_phone || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (schoolError) throw schoolError;

    // 2. Create the admin auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        full_name: admin_full_name,
        school_id: school.id,
      },
    });

    if (authError) {
      // Rollback school creation
      await supabase.from("schools").delete().eq("id", school.id);
      throw authError;
    }

    const userId = authData.user.id;

    // 3. Assign admin role
    await supabase.from("user_roles").insert({
      user_id: userId,
      role: "admin",
      school_id: school.id,
    });

    // 4. Create staff record
    const nameParts = admin_full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Admin";
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

    await supabase.from("staff").insert({
      user_id: userId,
      employee_id: `EMP-${Date.now().toString().slice(-6)}`,
      first_name: firstName,
      last_name: lastName,
      email: admin_email,
      gender: "male",
      school_id: school.id,
    });

    // Completes the audit-log coverage across the super-admin edge
    // functions (manage-school's actions all log now too) — creating a
    // brand-new tenant is exactly the kind of platform-level event that
    // should be traceable.
    if (created_by) {
      try {
        await supabase.from("audit_log").insert({
          user_id: created_by,
          action: "super_admin_create_school",
          entity_type: "schools",
          entity_id: school.id,
          school_id: school.id,
          details: { school_name: school.name, school_code: school.school_code, admin_email },
        });
      } catch { /* non-fatal */ }
    }

    return new Response(
      JSON.stringify({
        message: "School and admin created successfully",
        school: { id: school.id, name: school.name, school_code: school.school_code },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

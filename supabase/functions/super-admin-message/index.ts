import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    // Verify caller is super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: saCheck } = await supabase
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!saCheck) {
      return new Response(JSON.stringify({ error: "Not a super admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "get_admin_recipients": {
        // Get all school admins grouped by school
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id, school_id, role")
          .eq("role", "admin");

        if (!adminRoles || adminRoles.length === 0) {
          return new Response(JSON.stringify({ admins: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const userIds = adminRoles.map(r => r.user_id);
        const schoolIds = [...new Set(adminRoles.map(r => r.school_id).filter(Boolean))];

        const [profilesRes, schoolsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds),
          supabase.from("schools").select("id, name").in("id", schoolIds),
        ]);

        const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p]));
        const schoolMap = Object.fromEntries((schoolsRes.data || []).map(s => [s.id, s]));

        const admins = adminRoles.map(r => ({
          user_id: r.user_id,
          school_id: r.school_id,
          full_name: profileMap[r.user_id]?.full_name || "Unknown",
          email: profileMap[r.user_id]?.email || "",
          school_name: r.school_id ? schoolMap[r.school_id]?.name || "Unknown School" : null,
        }));

        return new Response(JSON.stringify({ admins }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_message": {
        const { subject, content, priority, message_type, recipient_user_ids } = body;

        if (!subject || !content) {
          return new Response(JSON.stringify({ error: "Subject and content required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        let finalRecipientIds: string[] = [];

        if (message_type === "specific" && recipient_user_ids?.length > 0) {
          // Send to specific admins
          finalRecipientIds = recipient_user_ids;
        } else if (message_type === "all_admins") {
          // Broadcast to all school admins
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");
          finalRecipientIds = (adminRoles || []).map(r => r.user_id);
        } else if (message_type === "all_users") {
          // Send to every user on the platform
          const { data: allProfiles } = await supabase
            .from("profiles")
            .select("user_id");
          finalRecipientIds = (allProfiles || []).map(p => p.user_id);
        }

        // Remove the sender from recipients
        finalRecipientIds = finalRecipientIds.filter(id => id !== user.id);

        if (finalRecipientIds.length === 0) {
          return new Response(JSON.stringify({ error: "No recipients found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Insert message using service role (bypasses RLS)
        const { data: message, error: msgError } = await supabase
          .from("messages")
          .insert({
            sender_id: user.id,
            subject,
            content,
            priority: priority || "normal",
            is_broadcast: message_type !== "specific",
            target_roles: message_type === "all_admins" ? ["admin"] : null,
          })
          .select()
          .single();

        if (msgError) throw msgError;

        // Insert recipients in batches of 500
        for (let i = 0; i < finalRecipientIds.length; i += 500) {
          const batch = finalRecipientIds.slice(i, i + 500).map(rid => ({
            message_id: message.id,
            recipient_id: rid,
          }));
          const { error: recError } = await supabase
            .from("message_recipients")
            .insert(batch);
          if (recError) throw recError;
        }

        return new Response(JSON.stringify({
          success: true,
          recipients_count: finalRecipientIds.length,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_sent_messages": {
        const { data: messages, error } = await supabase
          .from("messages")
          .select("*")
          .eq("sender_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        // Get recipient counts for each message
        const msgIds = (messages || []).map(m => m.id);
        let recipientCounts: Record<string, number> = {};
        if (msgIds.length > 0) {
          const { data: counts } = await supabase
            .from("message_recipients")
            .select("message_id")
            .in("message_id", msgIds);
          if (counts) {
            for (const c of counts) {
              recipientCounts[c.message_id] = (recipientCounts[c.message_id] || 0) + 1;
            }
          }
        }

        const enriched = (messages || []).map(m => ({
          ...m,
          recipient_count: recipientCounts[m.id] || 0,
        }));

        return new Response(JSON.stringify({ messages: enriched }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

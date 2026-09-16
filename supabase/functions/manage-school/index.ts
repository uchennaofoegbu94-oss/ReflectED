import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Every write action below calls this — completes the audit-log coverage
// for manage-school (previously only reset_password/force_logout did
// this explicitly; every other mutating super-admin action — disabling a
// school, editing its profile, deleting it, creating a user, transferring
// admin ownership, locking a user, flipping a feature flag, editing a
// support ticket, posting/toggling an announcement — wrote nothing to
// audit_log at all). Best-effort: a logging failure never blocks the
// real action, same reasoning as the DB-trigger side (see
// audit_log_triggers migration).
async function logAudit(
  supabase: any,
  actor: { id: string; email?: string | null },
  action: string,
  entityType: string,
  entityId: string | null,
  schoolId: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_log").insert({
      user_id: actor.id,
      user_name: actor.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      school_id: schoolId,
      details: details ?? null,
    });
  } catch {
    // non-fatal — never let audit logging break the real operation
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: saCheck } = await supabase
      .from("super_admins").select("id").eq("user_id", user.id).maybeSingle();
    if (!saCheck) return json({ error: "Not a super admin" }, 403);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ─── School Details ───
      case "get_school_details": {
        const { school_id } = body;
        const [schoolRes, studentsRes, staffRes, classesRes] = await Promise.all([
          supabase.from("schools").select("*").eq("id", school_id).single(),
          supabase.from("students").select("id, first_name, last_name, admission_number, gender, user_id, class_id, created_at").eq("school_id", school_id),
          supabase.from("staff").select("id, first_name, last_name, email, employee_id, user_id, created_at").eq("school_id", school_id),
          supabase.from("class_arms").select("id, name, arm, level").eq("school_id", school_id),
        ]);

        const { data: adminRoles } = await supabase
          .from("user_roles").select("user_id").eq("school_id", school_id).eq("role", "admin");

        let adminProfiles: any[] = [];
        if (adminRoles && adminRoles.length > 0) {
          const { data } = await supabase
            .from("profiles").select("user_id, full_name, email")
            .in("user_id", adminRoles.map(r => r.user_id));
          adminProfiles = data || [];
        }

        return json({
          school: schoolRes.data,
          students: studentsRes.data || [],
          staff: staffRes.data || [],
          classes: classesRes.data || [],
          admins: adminProfiles,
        });
      }

      // ─── Toggle School Status ───
      case "toggle_school_status": {
        const { school_id, is_active } = body;
        const { error } = await supabase
          .from("schools").update({ is_active, updated_at: new Date().toISOString() }).eq("id", school_id);
        if (error) throw error;
        await logAudit(supabase, user, is_active ? "super_admin_activate_school" : "super_admin_deactivate_school", "schools", school_id, school_id);
        return json({ success: true });
      }

      // ─── Edit School Profile ───
      case "edit_school_profile": {
        const { school_id, name, email, phone, address, logo_url } = body;
        const updates: any = { updated_at: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (phone !== undefined) updates.phone = phone;
        if (address !== undefined) updates.address = address;
        if (logo_url !== undefined) updates.logo_url = logo_url;

        const { error } = await supabase.from("schools").update(updates).eq("id", school_id);
        if (error) throw error;
        await logAudit(supabase, user, "super_admin_edit_school_profile", "schools", school_id, school_id, { fields: Object.keys(updates) });
        return json({ success: true });
      }

      // ─── Delete School ───
      case "delete_school": {
        const { school_id } = body;
        // Capture the name before it's gone — needed for the audit
        // record below, which is the one thing that should survive this
        // deletion (audit_log itself is deliberately no longer in the
        // purge list beneath, for exactly that reason — a school being
        // deleted is precisely the kind of event that should still be
        // visible in the audit trail afterward).
        const { data: schoolBeingDeleted } = await supabase.from("schools").select("name").eq("id", school_id).maybeSingle();
        const tables = [
          "support_tickets", "school_feature_flags", "login_history",
          "quiz_answers", "quiz_attempts", "quiz_questions", "quizzes",
          "submissions", "attachments", "assignments",
          "stream_posts", "post_comments",
          "classroom_materials", "classroom_syllabus", "classroom_co_teachers",
          "classroom_members", "live_class_sessions", "classrooms",
          "assessment_scores", "assessment_scores_tracker", "broadsheet_field_scores",
          "broadsheet_fields", "result_transcripts",
          "attendance_records", "attendance_parameters",
          "event_participants", "event_supporters", "events",
          "payments", "fee_structures", "school_expenses",
          "message_recipients", "messages", "notifications",
          "assignment_notifications", "parent_notifications",
          "timetable_slots", "class_subjects", "special_roles",
          "role_definitions", "school_settings", "grading_scales",
          "grading_rubrics", "staff_clock_records",
          "terms", "academic_sessions", "school_subscriptions",
        ];
        for (const table of tables) {
          await supabase.from(table).delete().eq("school_id", school_id);
        }

        const { data: schoolStudents } = await supabase.from("students").select("user_id").eq("school_id", school_id);
        const { data: schoolStaff } = await supabase.from("staff").select("user_id").eq("school_id", school_id);
        const userIds = [
          ...(schoolStudents || []).map(s => s.user_id).filter(Boolean),
          ...(schoolStaff || []).map(s => s.user_id).filter(Boolean),
        ];

        await supabase.from("students").delete().eq("school_id", school_id);
        await supabase.from("staff").delete().eq("school_id", school_id);

        if (userIds.length > 0) {
          await supabase.from("user_roles").delete().in("user_id", userIds);
          await supabase.from("profiles").delete().in("user_id", userIds);
          for (const uid of userIds) {
            await supabase.auth.admin.deleteUser(uid);
          }
        }
        await supabase.from("schools").delete().eq("id", school_id);
        // Logged last, deliberately: this is the one record that should
        // outlive the school it describes.
        await logAudit(supabase, user, "super_admin_delete_school", "schools", school_id, null, { school_name: schoolBeingDeleted?.name ?? null });
        return json({ success: true });
      }

      // ─── Create User ───
      case "create_user": {
        const { school_id, email, password, full_name, role } = body;
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { full_name, school_id },
        });
        if (authError) throw authError;
        const userId = authData.user.id;

        await supabase.from("user_roles").insert({ user_id: userId, role, school_id });

        const nameParts = full_name.trim().split(/\s+/);
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
        const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null;

        if (role === "student") {
          await supabase.from("students").insert({
            user_id: userId, admission_number: `STU-${Date.now().toString().slice(-6)}`,
            first_name: firstName, last_name: lastName, middle_name: middleName,
            gender: "male", school_id,
          });
        } else {
          await supabase.from("staff").insert({
            user_id: userId, employee_id: `EMP-${Date.now().toString().slice(-6)}`,
            first_name: firstName, last_name: lastName, middle_name: middleName,
            email, gender: "male", school_id,
          });
        }
        await logAudit(supabase, user, "super_admin_create_user", role === "student" ? "students" : "staff", userId, school_id, { email, role });
        return json({ success: true, user_id: userId });
      }

      // ─── Switch Admin ───
      case "switch_admin": {
        const { school_id, new_admin_user_id } = body;
        const { data: currentAdmins } = await supabase
          .from("user_roles").select("id, user_id").eq("school_id", school_id).eq("role", "admin");

        if (currentAdmins && currentAdmins.length > 0) {
          for (const admin of currentAdmins) {
            await supabase.from("user_roles").update({ role: "teacher" }).eq("id", admin.id);
          }
        }

        const { data: existingRole } = await supabase
          .from("user_roles").select("id").eq("user_id", new_admin_user_id).eq("school_id", school_id).maybeSingle();

        if (existingRole) {
          await supabase.from("user_roles").update({ role: "admin" }).eq("id", existingRole.id);
        } else {
          await supabase.from("user_roles").insert({ user_id: new_admin_user_id, role: "admin", school_id });
        }
        await logAudit(supabase, user, "super_admin_switch_admin", "user_roles", new_admin_user_id, school_id, {
          previous_admins: (currentAdmins || []).map((a: any) => a.user_id),
        });
        return json({ success: true });
      }

      // ─── Send Password Reset Email ───
      // Changed from directly setting a new password (the super admin
      // typing/seeing the user's new password) to triggering Supabase's
      // own recovery email instead — the target user sets their own new
      // password via the link, the admin never sees or chooses it.
      case "reset_password": {
        const { target_email, target_user_id, redirect_to } = body;
        if (!target_email) return json({ error: "target_email is required" }, 400);
        const { error } = await supabase.auth.resetPasswordForEmail(target_email, {
          redirectTo: redirect_to,
        });
        if (error) throw error;
        await logAudit(supabase, user, "super_admin_reset_password", "auth_user", target_user_id ?? null, null, { target_email });
        return json({ success: true });
      }

      // ─── Force Logout (revoke all active sessions) ───
      // Distinct from banning: a ban blocks future logins but doesn't by
      // itself invalidate a refresh token already in the user's browser.
      // This explicitly revokes every session for the user right now.
      case "force_logout": {
        const { target_user_id } = body;
        if (!target_user_id) return json({ error: "target_user_id is required" }, 400);
        const { error } = await supabase.auth.admin.signOut(target_user_id, "global");
        if (error) throw error;
        await logAudit(supabase, user, "super_admin_force_logout", "auth_user", target_user_id, null);
        return json({ success: true });
      }

      // ─── Lock / Unlock User ───
      case "toggle_user_lock": {
        const { target_user_id, ban } = body;
        if (ban) {
          const { error } = await supabase.auth.admin.updateUserById(target_user_id, {
            ban_duration: "876000h", // ~100 years
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.admin.updateUserById(target_user_id, {
            ban_duration: "none",
          });
          if (error) throw error;
        }
        await logAudit(supabase, user, ban ? "super_admin_lock_user" : "super_admin_unlock_user", "auth_user", target_user_id, null);
        return json({ success: true });
      }

      // ─── Get All Users Across Schools ───
      case "get_all_users": {
        const { data: roles } = await supabase
          .from("user_roles").select("user_id, role, school_id");
        const userIds = [...new Set((roles || []).map(r => r.user_id))];
        const schoolIds = [...new Set((roles || []).map(r => r.school_id).filter(Boolean))];

        const [profilesRes, schoolsRes] = await Promise.all([
          userIds.length > 0 ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds) : { data: [] },
          schoolIds.length > 0 ? supabase.from("schools").select("id, name").in("id", schoolIds) : { data: [] },
        ]);

        const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p]));
        const schoolMap = Object.fromEntries((schoolsRes.data || []).map(s => [s.id, s]));

        const users = (roles || []).map(r => ({
          user_id: r.user_id,
          role: r.role,
          school_id: r.school_id,
          full_name: profileMap[r.user_id]?.full_name || "Unknown",
          email: profileMap[r.user_id]?.email || "",
          school_name: r.school_id ? schoolMap[r.school_id]?.name || "Unknown" : null,
        }));

        return json({ users });
      }

      // ─── Platform-wide Stats ───
      case "get_platform_stats": {
        const [schoolsRes, studentsRes, staffRes, classesRes, feesRes, attendanceRes, ticketsRes] = await Promise.all([
          supabase.from("schools").select("id, name, is_active, created_at"),
          supabase.from("students").select("id, school_id, created_at"),
          supabase.from("staff").select("id, school_id, created_at"),
          supabase.from("class_arms").select("id, school_id"),
          supabase.from("payments").select("id, amount, school_id, created_at"),
          supabase.from("attendance_records").select("id, school_id"),
          supabase.from("support_tickets").select("id, status"),
        ]);

        const schools = schoolsRes.data || [];
        const students = studentsRes.data || [];
        const staffList = staffRes.data || [];
        const classes = classesRes.data || [];
        const payments = feesRes.data || [];
        const attendance = attendanceRes.data || [];
        const tickets = ticketsRes.data || [];

        // Per-school breakdown
        const schoolBreakdown = schools.map(s => {
          const sStudents = students.filter(st => st.school_id === s.id).length;
          const sStaff = staffList.filter(st => st.school_id === s.id).length;
          const sClasses = classes.filter(c => c.school_id === s.id).length;
          const sRevenue = payments.filter(p => p.school_id === s.id).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const sAttendance = attendance.filter(a => a.school_id === s.id).length;
          return {
            id: s.id, name: s.name, is_active: s.is_active,
            students: sStudents, staff: sStaff, classes: sClasses,
            revenue: sRevenue, attendance_records: sAttendance,
          };
        });

        return json({
          totals: {
            schools: schools.length,
            active_schools: schools.filter(s => s.is_active).length,
            students: students.length,
            staff: staffList.length,
            classes: classes.length,
            total_revenue: payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
            attendance_records: attendance.length,
            open_tickets: tickets.filter(t => t.status === 'open').length,
          },
          school_breakdown: schoolBreakdown,
        });
      }

      // ─── Feature Flags ───
      case "get_feature_flags": {
        const { school_id } = body;
        const { data, error } = await supabase
          .from("school_feature_flags").select("*").eq("school_id", school_id);
        if (error) throw error;
        return json({ flags: data || [] });
      }

      case "set_feature_flag": {
        const { school_id, module_name, is_enabled } = body;
        const { error } = await supabase
          .from("school_feature_flags")
          .upsert({ school_id, module_name, is_enabled, updated_at: new Date().toISOString() },
            { onConflict: "school_id,module_name" });
        if (error) throw error;
        await logAudit(supabase, user, "super_admin_set_feature_flag", "school_feature_flags", null, school_id, { module_name, is_enabled });
        return json({ success: true });
      }

      case "init_feature_flags": {
        const { school_id } = body;
        const modules = ["cbt_quizzes", "lms_classroom", "attendance", "timetable", "events", "fees_payments", "results", "id_cards", "parent_portal"];
        const inserts = modules.map(m => ({ school_id, module_name: m, is_enabled: true }));
        await supabase.from("school_feature_flags").upsert(inserts, { onConflict: "school_id,module_name" });
        const { data } = await supabase.from("school_feature_flags").select("*").eq("school_id", school_id);
        return json({ flags: data || [] });
      }

      // ─── Support Tickets ───
      case "get_all_tickets": {
        const { data: tickets, error } = await supabase
          .from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) throw error;

        // Enrich with school names and submitter names
        const schoolIds = [...new Set((tickets || []).map(t => t.school_id).filter(Boolean))];
        const userIds = [...new Set((tickets || []).map(t => t.submitted_by).filter(Boolean))];

        const [schoolsRes, profilesRes] = await Promise.all([
          schoolIds.length > 0 ? supabase.from("schools").select("id, name").in("id", schoolIds) : { data: [] },
          userIds.length > 0 ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds) : { data: [] },
        ]);

        const schoolMap = Object.fromEntries((schoolsRes.data || []).map(s => [s.id, s.name]));
        const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.user_id, p]));

        const enriched = (tickets || []).map(t => ({
          ...t,
          school_name: t.school_id ? schoolMap[t.school_id] || "Unknown" : null,
          submitter_name: profileMap[t.submitted_by]?.full_name || "Unknown",
          submitter_email: profileMap[t.submitted_by]?.email || "",
        }));

        return json({ tickets: enriched });
      }

      case "update_ticket": {
        const { ticket_id, status, resolution_notes, priority } = body;
        const updates: any = { updated_at: new Date().toISOString() };
        if (status !== undefined) updates.status = status;
        if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
        if (priority !== undefined) updates.priority = priority;

        const { error } = await supabase.from("support_tickets").update(updates).eq("id", ticket_id);
        if (error) throw error;
        await logAudit(supabase, user, "super_admin_update_ticket", "support_tickets", ticket_id, null, { fields: Object.keys(updates) });
        return json({ success: true });
      }

      // ─── Audit Log Cross-School ───
      case "get_audit_logs": {
        const { limit: logLimit = 100, entity_type, school_id: filterSchoolId, date_from, date_to } = body;
        let logsQuery = supabase
          .from("audit_log").select("*").order("created_at", { ascending: false }).limit(logLimit);
        if (entity_type) logsQuery = logsQuery.eq("entity_type", entity_type);
        if (filterSchoolId) logsQuery = logsQuery.eq("school_id", filterSchoolId);
        if (date_from) logsQuery = logsQuery.gte("created_at", `${date_from}T00:00:00`);
        if (date_to) logsQuery = logsQuery.lte("created_at", `${date_to}T23:59:59`);
        const { data: logs, error } = await logsQuery;
        if (error) throw error;

        const schoolIds = [...new Set((logs || []).map(l => l.school_id).filter(Boolean))];
        let schoolMap: Record<string, string> = {};
        if (schoolIds.length > 0) {
          const { data } = await supabase.from("schools").select("id, name").in("id", schoolIds);
          schoolMap = Object.fromEntries((data || []).map(s => [s.id, s.name]));
        }

        return json({
          logs: (logs || []).map(l => ({ ...l, school_name: l.school_id ? schoolMap[l.school_id] || "Unknown" : null })),
        });
      }

      // ─── Platform Announcements ───
      case "get_announcements": {
        const { data, error } = await supabase
          .from("platform_announcements").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return json({ announcements: data || [] });
      }

      case "create_announcement": {
        const { title, content, announcement_type, priority, starts_at, ends_at } = body;
        const { error } = await supabase.from("platform_announcements").insert({
          title, content, announcement_type: announcement_type || "notice",
          priority: priority || "normal", created_by: user.id,
          starts_at: starts_at || new Date().toISOString(),
          ends_at: ends_at || null,
        });
        if (error) throw error;
        await logAudit(supabase, user, "super_admin_create_announcement", "platform_announcements", null, null, { title });
        return json({ success: true });
      }

      case "toggle_announcement": {
        const { announcement_id, is_active } = body;
        const { error } = await supabase.from("platform_announcements")
          .update({ is_active, updated_at: new Date().toISOString() }).eq("id", announcement_id);
        if (error) throw error;
        await logAudit(supabase, user, is_active ? "super_admin_enable_announcement" : "super_admin_disable_announcement", "platform_announcements", announcement_id, null);
        return json({ success: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

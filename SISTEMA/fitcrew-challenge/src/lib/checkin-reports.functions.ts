import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const reportCheckin = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      checkinId: z.string().uuid(),
      reason: z.string().trim().min(3).max(500),
    }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ck } = await supabase
      .from("checkins")
      .select("id, user_id, challenge_id")
      .eq("id", data.checkinId)
      .maybeSingle();
    if (!ck) throw new Error("Check-in não encontrado.");
    if (ck.user_id === userId) throw new Error("Você não pode denunciar o próprio check-in.");

    const { error } = await (supabase as any).from("checkin_reports").insert({
      checkin_id: ck.id,
      challenge_id: ck.challenge_id,
      reporter_id: userId,
      reason: data.reason,
    });
    if (error) {
      if (`${error.message}`.toLowerCase().includes("duplicate")) {
        throw new Error("Você já denunciou este check-in.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const listCheckinReports = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ status: z.enum(["pending", "dismissed", "upheld"]).default("pending") }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    void context; // userId not needed here
    const { data: reports } = await (supabase as any)
      .from("checkin_reports")
      .select("id, checkin_id, challenge_id, reporter_id, reason, status, created_at")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (reports ?? []) as any[];
    if (!rows.length) return { items: [] as any[] };

    const checkinIds = Array.from(new Set(rows.map((r: any) => r.checkin_id)));
    const reporterIds = Array.from(new Set(rows.map((r: any) => r.reporter_id)));
    const { data: checkins } = await (supabase as any)
      .from("checkins")
      .select("id, user_id, occurred_on, duration_min, photo_url, caption, ai_validated")
      .in("id", checkinIds);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username")
      .in("id", Array.from(new Set([...(checkins ?? []).map((c: any) => c.user_id), ...reporterIds])));

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const checkinMap = new Map((checkins ?? []).map((c: any) => [c.id, c]));

    // Signed URLs
    const paths = (checkins ?? []).map((c: any) => c.photo_url).filter(Boolean);
    const signedMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("checkin-photos").createSignedUrls(paths, 3600);
      (signed ?? []).forEach((s: any) => {
        if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
      });
    }
    // Group by checkin: count reports per checkin
    const countByCheckin = new Map<string, number>();
    for (const r of rows) {
      countByCheckin.set(r.checkin_id, (countByCheckin.get(r.checkin_id) ?? 0) + 1);
    }

    const items = rows.map((r: any) => {
      const ck: any = checkinMap.get(r.checkin_id);
      return {
        id: r.id,
        reason: r.reason,
        created_at: r.created_at,
        reporter: profileMap.get(r.reporter_id) ?? null,
        checkin: ck
          ? {
              id: ck.id,
              occurred_on: ck.occurred_on,
              duration_min: ck.duration_min,
              caption: ck.caption,
              ai_validated: ck.ai_validated,
              photo_signed_url: ck.photo_url ? signedMap.get(ck.photo_url) ?? null : null,
              author: profileMap.get(ck.user_id) ?? null,
              total_reports: countByCheckin.get(ck.id) ?? 1,
            }
          : null,
      };
    });
    return { items };
  });

export const resolveCheckinReport = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["dismiss", "uphold"]),
    }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: super_admin OR challenge owner/co_admin
    const { data: report } = await (supabase as any)
      .from("checkin_reports")
      .select("id, checkin_id, challenge_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!report) throw new Error("Denúncia não encontrada.");
    if (report.status !== "pending") throw new Error("Denúncia já resolvida.");

    const { data: superAdm } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    let allowed = !!superAdm;
    if (!allowed) {
      const { data: mem } = await supabase
        .from("challenge_members")
        .select("role")
        .eq("challenge_id", report.challenge_id)
        .eq("user_id", userId)
        .maybeSingle();
      allowed = mem?.role === "owner" || mem?.role === "co_admin";
    }
    if (!allowed) throw new Error("Sem permissão.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const newStatus = data.action === "dismiss" ? "dismissed" : "upheld";

    await (supabaseAdmin as any)
      .from("checkin_reports")
      .update({
        status: newStatus,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (data.action === "uphold") {
      await (supabaseAdmin as any)
        .from("checkin_reports")
        .update({
          status: "upheld",
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .eq("checkin_id", report.checkin_id)
        .eq("status", "pending");

      await (supabaseAdmin as any)
        .from("checkins")
        .update({ ai_validated: "rejected", points_awarded: 0, over_limit: true })
        .eq("id", report.checkin_id);

      await (supabaseAdmin as any).from("checkin_moderation_audit").insert({
        checkin_id: report.checkin_id,
        challenge_id: report.challenge_id,
        actor_id: userId,
        action: "rejected",
        reasons: ["community_report"],
        reasons_text: "Rejeitado após denúncia da comunidade",
        notes: null,
      });
    }
    return { ok: true };
  });

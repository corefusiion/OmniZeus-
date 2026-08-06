import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Acesso restrito ao Super Admin.");
}

// ---------- Flagged comments ----------

export const listFlaggedComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(200).default(100) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { limit } = data;

    const [postCs, checkinCs] = await Promise.all([
      context.supabase
        .from("post_comments")
        .select("id, post_id, user_id, body, created_at, flagged_terms")
        .not("flagged_terms", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit),
      context.supabase
        .from("checkin_comments")
        .select("id, checkin_id, user_id, body, created_at, flagged_terms")
        .not("flagged_terms", "is", null)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    const rows = [
      ...(postCs.data ?? []).map((r: any) => ({
        id: r.id,
        source: "post_comment" as const,
        parent_id: r.post_id,
        user_id: r.user_id,
        body: r.body,
        created_at: r.created_at,
        terms: r.flagged_terms ?? [],
      })),
      ...(checkinCs.data ?? []).map((r: any) => ({
        id: r.id,
        source: "checkin_comment" as const,
        parent_id: r.checkin_id,
        user_id: r.user_id,
        body: r.body,
        created_at: r.created_at,
        terms: r.flagged_terms ?? [],
      })),
    ]
      .filter((r) => Array.isArray(r.terms) && r.terms.length > 0)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  });

export const clearFlaggedComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; source: "post_comment" | "checkin_comment" }) =>
    z
      .object({
        id: z.string().uuid(),
        source: z.enum(["post_comment", "checkin_comment"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const table = data.source === "post_comment" ? "post_comments" : "checkin_comments";
    const { error } = await context.supabase
      .from(table)
      .update({ flagged_terms: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFlaggedComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; source: "post_comment" | "checkin_comment" }) =>
    z
      .object({
        id: z.string().uuid(),
        source: z.enum(["post_comment", "checkin_comment"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const table = data.source === "post_comment" ? "post_comments" : "checkin_comments";
    const { error } = await context.supabase.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Banned words ----------

export const listBannedWords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("banned_words")
      .select("word, active, severity, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertBannedWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { word: string; severity?: number; active?: boolean }) =>
    z
      .object({
        word: z.string().trim().min(2).max(60),
        severity: z.number().int().min(1).max(5).default(1),
        active: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const word = data.word.toLowerCase();
    const { error } = await context.supabase
      .from("banned_words")
      .upsert({ word, severity: data.severity, active: data.active }, { onConflict: "word" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBannedWord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { word: string }) => z.object({ word: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("banned_words").delete().eq("word", data.word);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Warnings history ----------

export const listUserWarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number; userId?: string }) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).default(200),
        userId: z.string().uuid().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("user_warnings")
      .select("id, user_id, source_type, source_id, terms, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // aggregate per user
    const grouped = new Map<
      string,
      { user_id: string; profile: any; total: number; last_at: string; terms: Record<string, number> }
    >();
    for (const r of rows ?? []) {
      const g =
        grouped.get(r.user_id) ??
        {
          user_id: r.user_id,
          profile: byId.get(r.user_id) ?? null,
          total: 0,
          last_at: r.created_at,
          terms: {} as Record<string, number>,
        };
      g.total += 1;
      if (r.created_at > g.last_at) g.last_at = r.created_at;
      for (const t of r.terms ?? []) g.terms[t] = (g.terms[t] ?? 0) + 1;
      grouped.set(r.user_id, g);
    }

    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, profile: byId.get(r.user_id) ?? null })),
      summary: Array.from(grouped.values()).sort((a, b) => b.total - a.total),
    };
  });

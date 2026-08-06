import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistMentions } from "@/lib/mentions.functions";

export type ChatAuthor = {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

export type ChatCheckinBrief = {
  id: string;
  caption: string | null;
  photo_url: string | null;
  points_awarded: number | null;
  occurred_on: string;
  exercise_name: string | null;
  author: ChatAuthor | null;
};

export type ChatMessage = {
  id: string;
  challenge_id: string;
  user_id: string;
  body: string | null;
  image_url: string | null;
  checkin_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  author: ChatAuthor;
  checkin: ChatCheckinBrief | null;
};

async function enrichMessages(supabase: any, rows: any[]): Promise<ChatMessage[]> {
  if (rows.length === 0) return [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const checkinIds = Array.from(new Set(rows.map((r) => r.checkin_id).filter(Boolean))) as string[];

  const [{ data: profiles }, checkinsRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username, avatar_url").in("id", userIds),
    checkinIds.length
      ? supabase
          .from("checkins")
          .select(
            "id, user_id, caption, photo_url, points_awarded, occurred_on, exercise_types(name)",
          )
          .in("id", checkinIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profById = new Map<string, ChatAuthor>();
  (profiles ?? []).forEach((p: any) => profById.set(p.id, p));

  const checkinsRaw = (checkinsRes as any).data ?? [];
  const checkinUserIds = Array.from(new Set(checkinsRaw.map((c: any) => c.user_id)));
  const extraProfIds = checkinUserIds.filter((id) => !profById.has(id as string));
  if (extraProfIds.length) {
    const { data: extra } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", extraProfIds);
    (extra ?? []).forEach((p: any) => profById.set(p.id, p));
  }

  const checkinById = new Map<string, ChatCheckinBrief>();
  checkinsRaw.forEach((c: any) => {
    checkinById.set(c.id, {
      id: c.id,
      caption: c.caption,
      photo_url: c.photo_url,
      points_awarded: c.points_awarded,
      occurred_on: c.occurred_on,
      exercise_name: c.exercise_types?.name ?? null,
      author: profById.get(c.user_id) ?? null,
    });
  });

  return rows.map((r) => ({
    id: r.id,
    challenge_id: r.challenge_id,
    user_id: r.user_id,
    body: r.body,
    image_url: r.image_url,
    checkin_id: r.checkin_id,
    created_at: r.created_at,
    edited_at: r.edited_at,
    deleted_at: r.deleted_at,
    author: profById.get(r.user_id) ?? {
      id: r.user_id,
      display_name: "Usuário",
      username: null,
      avatar_url: null,
    },
    checkin: r.checkin_id ? checkinById.get(r.checkin_id) ?? null : null,
  }));
}

export const listChallengeMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
        before: z.string().datetime().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ChatMessage[]> => {
    let q = context.supabase
      .from("challenge_messages")
      .select("id, challenge_id, user_id, body, image_url, checkin_id, created_at, edited_at, deleted_at")
      .eq("challenge_id", data.challengeId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const enriched = await enrichMessages(context.supabase, rows ?? []);
    // return in chronological order
    return enriched.reverse();
  });

export const sendChallengeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        body: z.string().max(2000).optional(),
        image_url: z.string().max(500).optional(),
        checkin_id: z.string().uuid().optional(),
      })
      .refine((d) => !!(d.body?.trim() || d.image_url || d.checkin_id), {
        message: "Mensagem vazia.",
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ChatMessage> => {
    const { supabase, userId } = context;
    const payload = {
      challenge_id: data.challengeId,
      user_id: userId,
      body: data.body?.trim() || null,
      image_url: data.image_url ?? null,
      checkin_id: data.checkin_id ?? null,
    };
    const { data: inserted, error } = await supabase
      .from("challenge_messages")
      .insert(payload as any)
      .select("id, challenge_id, user_id, body, image_url, checkin_id, created_at, edited_at, deleted_at")
      .single();
    if (error) throw new Error(error.message);

    // Persist @mentions (best-effort, doesn't block)
    if (payload.body) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();
      try {
        await persistMentions({
          supabase,
          authorId: userId,
          sourceType: "post_comment",
          sourceId: inserted.id,
          body: payload.body,
          link: `/c/${data.challengeId}/chat`,
          actorName: (prof as any)?.display_name ?? "Alguém",
        });
      } catch {
        /* ignore */
      }
    }

    const [msg] = await enrichMessages(supabase, [inserted]);
    return msg;
  });

export const deleteChallengeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("challenge_messages")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyRecentCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("checkins")
      .select(
        "id, caption, photo_url, points_awarded, occurred_on, exercise_types(name)",
      )
      .eq("user_id", context.userId)
      .eq("challenge_id", data.challengeId)
      .order("occurred_on", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((c: any) => ({
      id: c.id,
      caption: c.caption,
      photo_url: c.photo_url,
      points_awarded: c.points_awarded,
      occurred_on: c.occurred_on,
      exercise_name: c.exercise_types?.name ?? null,
    }));
  });

// Lightweight summaries for the chat launcher: last message per challenge
export type ChatSummary = {
  challenge_id: string;
  last_message_at: string | null;
  last_body: string | null;
};

export const getChatSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatSummary[]> => {
    const { supabase, userId } = context;
    const { data: members, error: mErr } = await (supabase as any)
      .from("challenge_members")
      .select("challenge_id")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    const ids = (members ?? []).map((m: any) => m.challenge_id as string);
    if (!ids.length) return [];

    // Fetch recent messages across these challenges; group latest per challenge.
    const { data: rows, error } = await supabase
      .from("challenge_messages")
      .select("challenge_id, body, created_at")
      .in("challenge_id", ids)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const seen = new Map<string, ChatSummary>();
    for (const r of rows ?? []) {
      const cid = (r as any).challenge_id as string;
      if (seen.has(cid)) continue;
      seen.set(cid, {
        challenge_id: cid,
        last_message_at: (r as any).created_at,
        last_body: (r as any).body,
      });
    }
    // Include challenges without messages too
    for (const cid of ids) {
      if (!seen.has(cid)) {
        seen.set(cid, { challenge_id: cid, last_message_at: null, last_body: null });
      }
    }
    return Array.from(seen.values());
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StoryAuthorGroup = {
  author_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  latest_at: string;
  has_unseen: boolean;
  stories: {
    id: string;
    media_url: string;
    media_kind: "image" | "video";
    caption: string | null;
    created_at: string;
    expires_at: string;
    signed_url: string | null;
  }[];
};

export const listChallengeStories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<StoryAuthorGroup[]> => {
    const { supabase } = context;
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await (supabase as any)
      .from("challenge_stories")
      .select("id, author_id, media_url, media_kind, caption, created_at, expires_at")
      .eq("challenge_id", data.challengeId)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const stories = (rows ?? []) as any[];
    if (!stories.length) return [];

    const authorIds = Array.from(new Set(stories.map((s) => s.author_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", authorIds);
    const byId = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => byId.set(p.id, p));

    // Sign URLs in batch (best-effort; ignore failures)
    const signedMap = new Map<string, string>();
    await Promise.all(
      stories.map(async (s) => {
        const { data: signed } = await supabase.storage
          .from("story-media")
          .createSignedUrl(s.media_url, 3600);
        if (signed?.signedUrl) signedMap.set(s.id, signed.signedUrl);
      }),
    );

    const groups = new Map<string, StoryAuthorGroup>();
    for (const s of stories) {
      const p = byId.get(s.author_id);
      let g = groups.get(s.author_id);
      if (!g) {
        g = {
          author_id: s.author_id,
          display_name: p?.display_name ?? "Sem nome",
          username: p?.username ?? null,
          avatar_url: p?.avatar_url ?? null,
          latest_at: s.created_at,
          has_unseen: true,
          stories: [],
        };
        groups.set(s.author_id, g);
      }
      if (s.created_at > g.latest_at) g.latest_at = s.created_at;
      g.stories.push({
        id: s.id,
        media_url: s.media_url,
        media_kind: s.media_kind,
        caption: s.caption,
        created_at: s.created_at,
        expires_at: s.expires_at,
        signed_url: signedMap.get(s.id) ?? null,
      });
    }
    // Sort by latest activity desc
    return Array.from(groups.values()).sort((a, b) =>
      b.latest_at.localeCompare(a.latest_at),
    );
  });

export const createStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        mediaUrl: z.string().min(1).max(500),
        mediaKind: z.enum(["image", "video"]),
        caption: z.string().trim().max(200).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await (supabase as any)
      .from("challenge_stories")
      .insert({
        challenge_id: data.challengeId,
        author_id: userId,
        media_url: data.mediaUrl,
        media_kind: data.mediaKind,
        caption: data.caption ?? null,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Falha ao publicar story.");
    return { id: inserted.id as string };
  });

export const deleteStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Fetch to know the storage path
    const { data: row } = await (supabase as any)
      .from("challenge_stories")
      .select("media_url")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await (supabase as any)
      .from("challenge_stories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.media_url) {
      await supabase.storage.from("story-media").remove([row.media_url]);
    }
    return { ok: true };
  });

import { supabase } from "@/integrations/supabase/client";
import type { FeedCheckin } from "@/lib/checkins.queries";

export type FeedPost = {
  id: string;
  user_id: string;
  body: string;
  media_url: string | null;
  media_signed_url: string | null;
  created_at: string;
  is_system?: boolean;
  system_kind?: string | null;
  author: { display_name: string; username: string | null; avatar_url: string | null; is_bot?: boolean } | null;
  reactions: { emoji: string; user_id: string }[];
  comments: {
    id: string;
    user_id: string;
    body: string;
    created_at: string;
    is_bot?: boolean;
    flagged_terms?: string[] | null;
    author: { display_name: string; username: string | null; avatar_url: string | null } | null;
  }[];
};


export type TimelineItem =
  | { kind: "checkin"; created_at: string; data: FeedCheckin }
  | { kind: "post"; created_at: string; data: FeedPost };

async function loadProfiles(userIds: string[]) {
  const map = new Map<string, { display_name: string; username: string | null; avatar_url: string | null; is_bot: boolean }>();
  if (!userIds.length) return map;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, is_bot")
    .in("id", userIds);
  (data ?? []).forEach((p: any) =>
    map.set(p.id, { display_name: p.display_name, username: p.username ?? null, avatar_url: p.avatar_url, is_bot: !!p.is_bot }),
  );
  return map;
}

async function signPaths(
  bucket: string,
  paths: string[],
  transform?: { width?: number; height?: number; quality?: number; resize?: "cover" | "contain" | "fill" },
) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  if (transform) {
    // Image transforms only work on single createSignedUrl calls.
    const unique = Array.from(new Set(paths));
    const results = await Promise.all(
      unique.map((p) =>
        supabase.storage
          .from(bucket)
          .createSignedUrl(p, 60 * 60, { transform })
          .then((r) => ({ path: p, url: r.data?.signedUrl ?? null })),
      ),
    );
    results.forEach((r) => {
      if (r.url) map.set(r.path, r.url);
    });
    return map;
  }
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
  (data ?? []).forEach((s) => {
    if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
  });
  return map;
}

export type TimelinePage = {
  items: TimelineItem[];
  nextCursor: string | null;
};

export const FEED_PAGE_SIZE = 20;

export async function fetchTimeline(
  challengeId: string,
  opts?: { limit?: number; before?: string | null },
): Promise<TimelinePage> {
  const limit = opts?.limit ?? FEED_PAGE_SIZE;
  const before = opts?.before ?? null;

  // Posts: RLS already restricts to challenges the user belongs to (plus
  // global posts). Não escopamos por challenge_id aqui para não esconder
  // Roasts do Coach publicados em outros desafios da mesma crew.
  let postsQuery = supabase
    .from("posts")
    .select(
      `id, user_id, body, media_url, challenge_id, created_at, is_system, system_kind,
       reactions:post_reactions(emoji, user_id),
       comments:post_comments(id, user_id, body, created_at, is_bot, flagged_terms)` as any,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) postsQuery = postsQuery.lt("created_at", before);


  // Check-ins: RLS já restringe aos desafios de que o usuário é membro.
  // Não escopamos por challenge_id para que o feed seja global entre todas as
  // crews do usuário (igual ao comportamento dos posts).
  let checkinsQuery = supabase
    .from("checkins")
    .select(
      `id, user_id, challenge_id, batch_id, occurred_on, duration_min, photo_url, caption, points_awarded, over_limit, used_daily_pose, ai_validated, created_at, location_name, location_address, location_lat, location_lng,
       exercise:exercise_types(name, icon, points),
       reactions:checkin_reactions(emoji, user_id),
       comments:checkin_comments(id, user_id, body, created_at, is_bot, flagged_terms)` as any,
    )
    .order("created_at", { ascending: false })
    .limit(limit * 2);
  if (before) checkinsQuery = checkinsQuery.lt("created_at", before);
  void challengeId;


  const [{ data: checkinRows, error: cErr }, { data: postRows, error: pErr }] = await Promise.all([
    checkinsQuery,
    postsQuery,
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;

  const ci = (checkinRows ?? []) as any[];
  const po = (postRows ?? []) as any[];

  const userIds = Array.from(
    new Set<string>([
      ...ci.map((r) => r.user_id),
      ...ci.flatMap((r) => (r.comments ?? []).map((c: any) => c.user_id)),
      ...po.map((r) => r.user_id),
      ...po.flatMap((r) => (r.comments ?? []).map((c: any) => c.user_id)),
    ]),
  );

  const challengeIds = Array.from(new Set<string>(ci.map((r) => r.challenge_id).filter(Boolean)));
  const [profiles, checkinSigned, postSigned, challengeNamesById] = await Promise.all([
    loadProfiles(userIds),
    signPaths(
      "checkin-photos",
      ci.map((r) => r.photo_url).filter(Boolean) as string[],
      { width: 800, quality: 75, resize: "contain" },
    ),
    signPaths(
      "post-media",
      po.map((r) => r.media_url).filter(Boolean) as string[],
      { width: 800, quality: 75, resize: "contain" },
    ),
    (async () => {
      const map = new Map<string, string>();
      if (!challengeIds.length) return map;
      const { data } = await supabase.from("challenges").select("id, name").in("id", challengeIds);
      (data ?? []).forEach((c: any) => map.set(c.id, c.name));
      return map;
    })(),
  ]);

  // Group check-ins by batch_id (fallback: single-row group by row id).
  const groups: any[][] = [];
  const groupIndex = new Map<string, number>();
  for (const r of ci) {
    const key = r.batch_id ?? `row:${r.id}`;
    const idx = groupIndex.get(key);
    if (idx == null) {
      groupIndex.set(key, groups.length);
      groups.push([r]);
    } else {
      groups[idx].push(r);
    }
  }

  const checkinItems: TimelineItem[] = groups.map((rows) => {
    // Anchor = newest row (they arrived DESC). Keep its interactions.
    const r = rows[0];
    const challenges = Array.from(
      new Map(
        rows.map((row) => [row.challenge_id, { id: row.challenge_id, name: challengeNamesById.get(row.challenge_id) ?? "Desafio" }]),
      ).values(),
    );
    return {
      kind: "checkin" as const,
      created_at: r.created_at,
      data: {
        id: r.id,
        user_id: r.user_id,
        challenge_id: r.challenge_id,
        batch_id: r.batch_id ?? null,
        challenges,
        occurred_on: r.occurred_on,
        duration_min: r.duration_min,
        photo_url: r.photo_url,
        photo_signed_url: r.photo_url ? checkinSigned.get(r.photo_url) ?? null : null,
        caption: r.caption,
        points_awarded: r.points_awarded,
        over_limit: r.over_limit,
        used_daily_pose: !!r.used_daily_pose,
        ai_validated: r.ai_validated ?? null,
        created_at: r.created_at,
        location_name: r.location_name ?? null,
        location_address: r.location_address ?? null,
        location_lat: r.location_lat ?? null,
        location_lng: r.location_lng ?? null,
        exercise: r.exercise ?? null,
        author: profiles.get(r.user_id) ?? null,
        reactions: r.reactions ?? [],
        comments: (r.comments ?? [])
          .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
          .map((c: any) => ({
            id: c.id,
            user_id: c.user_id,
            body: c.body,
            created_at: c.created_at,
            is_bot: !!c.is_bot,
            flagged_terms: (c.flagged_terms ?? null) as string[] | null,
            author: profiles.get(c.user_id) ?? null,
          })),
      },
    };
  });

  const postItems: TimelineItem[] = po.map((r) => ({
    kind: "post" as const,
    created_at: r.created_at,
    data: {
      id: r.id,
      user_id: r.user_id,
      body: r.body,
      media_url: r.media_url,
      media_signed_url: r.media_url ? postSigned.get(r.media_url) ?? null : null,
      created_at: r.created_at,
      is_system: !!r.is_system,
      system_kind: r.system_kind ?? null,
      author: profiles.get(r.user_id) ?? null,
      reactions: r.reactions ?? [],
      comments: (r.comments ?? [])
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        .map((c: any) => ({
          id: c.id,
          user_id: c.user_id,
          body: c.body,
          created_at: c.created_at,
          is_bot: !!c.is_bot,
          flagged_terms: (c.flagged_terms ?? null) as string[] | null,
          author: profiles.get(c.user_id) ?? null,
        })),

    },
  }));

  const merged = [...checkinItems, ...postItems].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  // Cursor = created_at of last item when we filled the page on either side.
  // Heuristic: only expose a cursor when either checkins or posts returned a full page.
  const hasMore = ci.length >= limit || po.length >= limit;
  const nextCursor = hasMore && merged.length ? merged[merged.length - 1].created_at : null;
  return { items: merged, nextCursor };
}

export async function fetchUserTimeline(userId: string): Promise<TimelineItem[]> {
  const [{ data: checkinRows, error: cErr }, { data: postRows, error: pErr }] = await Promise.all([
    supabase
      .from("checkins")
      .select(
        `id, user_id, challenge_id, batch_id, occurred_on, duration_min, photo_url, caption, points_awarded, over_limit, used_daily_pose, ai_validated, created_at, location_name, location_address, location_lat, location_lng,
         exercise:exercise_types(name, icon, points),
         reactions:checkin_reactions(emoji, user_id),
         comments:checkin_comments(id, user_id, body, created_at, is_bot, flagged_terms)` as any,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("posts")
      .select(
        `id, user_id, body, media_url, created_at, is_system, system_kind,
         reactions:post_reactions(emoji, user_id),
         comments:post_comments(id, user_id, body, created_at, is_bot, flagged_terms)` as any,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;

  const ci = (checkinRows ?? []) as any[];
  const po = (postRows ?? []) as any[];

  const userIds = Array.from(
    new Set<string>([
      ...ci.map((r) => r.user_id),
      ...ci.flatMap((r) => (r.comments ?? []).map((c: any) => c.user_id)),
      ...po.map((r) => r.user_id),
      ...po.flatMap((r) => (r.comments ?? []).map((c: any) => c.user_id)),
    ]),
  );

  const challengeIds = Array.from(new Set<string>(ci.map((r) => r.challenge_id).filter(Boolean)));
  const [profiles, checkinSigned, postSigned, challengeNamesById] = await Promise.all([
    loadProfiles(userIds),
    signPaths("checkin-photos", ci.map((r) => r.photo_url).filter(Boolean) as string[], { width: 800, quality: 75, resize: "contain" }),
    signPaths("post-media", po.map((r) => r.media_url).filter(Boolean) as string[], { width: 800, quality: 75, resize: "contain" }),
    (async () => {
      const map = new Map<string, string>();
      if (!challengeIds.length) return map;
      const { data } = await supabase.from("challenges").select("id, name").in("id", challengeIds);
      (data ?? []).forEach((c: any) => map.set(c.id, c.name));
      return map;
    })(),
  ]);

  const groups: any[][] = [];
  const groupIndex = new Map<string, number>();
  for (const r of ci) {
    const key = r.batch_id ?? `row:${r.id}`;
    const idx = groupIndex.get(key);
    if (idx == null) {
      groupIndex.set(key, groups.length);
      groups.push([r]);
    } else {
      groups[idx].push(r);
    }
  }

  const checkinItems: TimelineItem[] = groups.map((rows) => {
    const r = rows[0];
    const challenges = Array.from(
      new Map(
        rows.map((row) => [row.challenge_id, { id: row.challenge_id, name: challengeNamesById.get(row.challenge_id) ?? "Desafio" }]),
      ).values(),
    );
    return {
      kind: "checkin" as const,
      created_at: r.created_at,
      data: {
        id: r.id,
        user_id: r.user_id,
        challenge_id: r.challenge_id,
        batch_id: r.batch_id ?? null,
        challenges,
        occurred_on: r.occurred_on,
        duration_min: r.duration_min,
        photo_url: r.photo_url,
        photo_signed_url: r.photo_url ? checkinSigned.get(r.photo_url) ?? null : null,
        caption: r.caption,
        points_awarded: r.points_awarded,
        over_limit: r.over_limit,
        used_daily_pose: !!r.used_daily_pose,
        ai_validated: r.ai_validated ?? null,
        created_at: r.created_at,
        location_name: r.location_name ?? null,
        location_address: r.location_address ?? null,
        location_lat: r.location_lat ?? null,
        location_lng: r.location_lng ?? null,
        exercise: r.exercise ?? null,
        author: profiles.get(r.user_id) ?? null,
        reactions: r.reactions ?? [],
        comments: (r.comments ?? [])
          .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
          .map((c: any) => ({
            id: c.id,
            user_id: c.user_id,
            body: c.body,
            created_at: c.created_at,
            is_bot: !!c.is_bot,
            flagged_terms: (c.flagged_terms ?? null) as string[] | null,
            author: profiles.get(c.user_id) ?? null,
          })),
      },
    };
  });

  const postItems: TimelineItem[] = po.map((r) => ({
    kind: "post" as const,
    created_at: r.created_at,
    data: {
      id: r.id,
      user_id: r.user_id,
      body: r.body,
      media_url: r.media_url,
      media_signed_url: r.media_url ? postSigned.get(r.media_url) ?? null : null,
      created_at: r.created_at,
      is_system: !!r.is_system,
      system_kind: r.system_kind ?? null,
      author: profiles.get(r.user_id) ?? null,
      reactions: r.reactions ?? [],
      comments: (r.comments ?? [])
        .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
        .map((c: any) => ({
          id: c.id,
          user_id: c.user_id,
          body: c.body,
          created_at: c.created_at,
          is_bot: !!c.is_bot,
          flagged_terms: (c.flagged_terms ?? null) as string[] | null,
          author: profiles.get(c.user_id) ?? null,
        })),
    },
  }));

  return [...checkinItems, ...postItems].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export async function uploadPostMedia(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("post-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

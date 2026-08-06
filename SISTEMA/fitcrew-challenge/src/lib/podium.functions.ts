import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function pub() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type PodiumEntry = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  total_points: number;
  total_checkins: number;
  total_minutes: number;
};

export type PodiumResult = {
  challenge: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string;
    status: string;
    closed_at: string | null;
    is_public: boolean;
  };
  podium: PodiumEntry[];
};

export const getChallengePodium = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<PodiumResult> => {
    const sb = pub();
    const { data: ch, error: chErr } = await sb
      .from("challenges")
      .select("id, name, starts_at, ends_at, status, closed_at, is_public")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);
    if (!ch) throw new Error("Desafio não encontrado.");

    const { data: rows, error } = await sb
      .from("checkins")
      .select("user_id, points_awarded, duration_min")
      .eq("challenge_id", data.challengeId)
      .eq("over_limit", false);
    if (error) throw new Error(error.message);

    const agg = new Map<string, { points: number; count: number; minutes: number }>();
    for (const r of rows ?? []) {
      const cur = agg.get(r.user_id as string) ?? { points: 0, count: 0, minutes: 0 };
      cur.points += r.points_awarded ?? 0;
      cur.count += 1;
      cur.minutes += r.duration_min ?? 0;
      agg.set(r.user_id as string, cur);
    }
    const top = [...agg.entries()]
      .sort((a, b) => b[1].points - a[1].points || b[1].count - a[1].count)
      .slice(0, 3);
    const ids = top.map(([id]) => id);
    if (ids.length === 0) return { challenge: ch, podium: [] };

    const { data: profs } = await sb
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", ids);
    const byId = new Map((profs ?? []).map((p) => [p.id as string, p]));
    const podium: PodiumEntry[] = top.map(([uid, s]) => {
      const p = byId.get(uid);
      return {
        user_id: uid,
        display_name: p?.display_name ?? "—",
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
        total_points: s.points,
        total_checkins: s.count,
        total_minutes: s.minutes,
      };
    });
    return { challenge: ch, podium };
  });

export type HallEntry = {
  challenge_id: string;
  challenge_name: string;
  ends_at: string;
  closed_at: string | null;
  winner: PodiumEntry | null;
};

export const listHallOfFame = createServerFn({ method: "GET" }).handler(async (): Promise<HallEntry[]> => {
  const sb = pub();
  const { data: closed, error } = await sb
    .from("challenges")
    .select("id, name, ends_at, closed_at")
    .eq("status", "closed")
    .eq("is_public", true)
    .order("closed_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  if (!closed || closed.length === 0) return [];

  const ids = closed.map((c) => c.id as string);
  const { data: winners } = await sb
    .from("user_badges")
    .select("user_id, challenge_id, earned_at, badges:badges!inner(slug)")
    .in("challenge_id", ids);
  const winnerByCh = new Map<string, string>();
  for (const w of winners ?? []) {
    const b = (w as unknown as { badges: { slug: string } }).badges;
    if (b.slug === "challenge_winner" && w.challenge_id) {
      winnerByCh.set(w.challenge_id as string, w.user_id as string);
    }
  }

  const userIds = [...new Set(winnerByCh.values())];
  const profMap = new Map<string, { display_name: string; username: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profs } = await sb
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);
    for (const p of profs ?? []) {
      profMap.set(p.id as string, {
        display_name: p.display_name as string,
        username: (p.username as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      });
    }
  }

  return closed.map((c) => {
    const uid = winnerByCh.get(c.id as string);
    const p = uid ? profMap.get(uid) : null;
    return {
      challenge_id: c.id as string,
      challenge_name: c.name as string,
      ends_at: c.ends_at as string,
      closed_at: (c.closed_at as string | null) ?? null,
      winner: uid && p
        ? {
            user_id: uid,
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
            total_points: 0,
            total_checkins: 0,
            total_minutes: 0,
          }
        : null,
    };
  });
});

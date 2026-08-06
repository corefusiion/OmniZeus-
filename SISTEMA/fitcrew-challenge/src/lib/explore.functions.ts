import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PublicChallenge = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  member_count: number;
  invite_code: string | null;
  city: string | null;
  banner_url: string | null;
  owner: { display_name: string | null; username: string | null; avatar_url: string | null; is_bot: boolean } | null;
  days_remaining: number;
  needs_first_human: boolean;
};


function daysRemaining(endsAt: string) {
  const end = new Date(`${endsAt}T23:59:59Z`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

export const listPublicChallenges = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z
      .object({ q: z.string().max(80).optional(), limit: z.number().int().min(1).max(50).default(30) })
      .parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<PublicChallenge[]> => {
    const client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    // Hide public challenges that ended more than 20 days ago from the discovery feed.
    const cutoff = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
    let query = (client as any)
      .from("challenges")
      .select("id, name, description, starts_at, ends_at, member_count, invite_code, city, banner_url, owner_id")
      .eq("is_public", true)
      .eq("is_active", true)
      .gte("ends_at", cutoff)
      .order("member_count", { ascending: false })
      .limit(data.limit);

    if (data.q && data.q.trim()) {
      const term = data.q.trim();
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,city.ilike.%${term}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((rows ?? []).map((r: any) => r.owner_id).filter(Boolean)));
    const owners = new Map<string, any>();
    if (ownerIds.length) {
      const { data: profs } = await (client as any)
        .from("profiles")
        .select("id, display_name, username, avatar_url, is_bot")
        .in("id", ownerIds);
      (profs ?? []).forEach((p: any) => owners.set(p.id, p));
    }

    // Bucket "challenge-banners" is private, but public challenge folders are readable by policy.
    const bannerPaths = (rows ?? [])
      .map((r: any) => r.banner_url)
      .filter((p: any): p is string => typeof p === "string" && p.length > 0);
    const signedMap = new Map<string, string>();
    if (bannerPaths.length) {
      const { data: signed, error: signErr } = await client.storage
        .from("challenge-banners")
        .createSignedUrls(bannerPaths, 60 * 60 * 24 * 7);
      if (signErr) throw new Error(signErr.message);
      (signed ?? []).forEach((s: any) => {
        if (s?.path && s?.signedUrl) signedMap.set(s.path, s.signedUrl);
      });
    }

    return (rows ?? []).map((r: any) => {
      const owner = owners.get(r.owner_id);
      const ownerIsBot = !!owner?.is_bot;
      const memberCount = r.member_count ?? 0;
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
        member_count: memberCount,
        invite_code: r.invite_code,
        city: r.city,
        banner_url: r.banner_url ? (signedMap.get(r.banner_url) ?? null) : null,
        owner: owner
          ? {
              display_name: owner.display_name,
              username: owner.username,
              avatar_url: owner.avatar_url,
              is_bot: ownerIsBot,
            }
          : null,
        needs_first_human: ownerIsBot && memberCount <= 1,
        days_remaining: daysRemaining(r.ends_at),
      };
    });
  });

export const setChallengePublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        isPublic: z.boolean(),
        city: z.string().trim().max(80).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await (supabase as any).rpc("is_challenge_admin", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (!ok) throw new Error("Acesso restrito ao admin do desafio.");
    const patch: Record<string, any> = { is_public: data.isPublic };
    if (data.city !== undefined) patch.city = data.city && data.city.length ? data.city : null;
    const { error } = await (supabase as any)
      .from("challenges")
      .update(patch)
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

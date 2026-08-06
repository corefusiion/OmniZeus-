import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type InvitePreviewPodium = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  total_points: number;
  counted_days: number;
};

export type InvitePreview = {
  challenge: {
    id: string;
    name: string;
    description: string | null;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
    banner_url: string | null;
    member_count: number | null;
    max_days_per_week: number | null;
  };
  podium: InvitePreviewPodium[];
  code: string;
};

/**
 * Public invite landing preview — anon-safe.
 * Uses SECURITY DEFINER RPCs; safe columns only.
 */
export const getInvitePreview = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    z.object({ code: z.string().trim().min(3).max(32) }).parse(data),
  )
  .handler(async ({ data }): Promise<InvitePreview | null> => {
    const code = data.code.toUpperCase();
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: rows, error } = await (client as any).rpc("get_challenge_by_invite", {
      _code: code,
    });
    if (error) return null;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;

    // Extra safe fields (banner_url, member_count, max_days_per_week) via anon read.
    // These columns are readable on public policies (invite_code is NOT).
    const { data: extra } = await (client as any)
      .from("challenges")
      .select("banner_url, member_count, max_days_per_week")
      .eq("id", row.id)
      .maybeSingle();

    // Podium (SECURITY DEFINER RPC)
    const { data: podium } = await (client as any).rpc("leaderboard_top_v1", {
      _challenge_id: row.id,
      _limit: 3,
    });

    return {
      code,
      challenge: {
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        is_active: row.is_active,
        banner_url: extra?.banner_url ?? null,
        member_count: extra?.member_count ?? null,
        max_days_per_week: extra?.max_days_per_week ?? null,
      },
      podium: (podium ?? []) as InvitePreviewPodium[],
    };
  });

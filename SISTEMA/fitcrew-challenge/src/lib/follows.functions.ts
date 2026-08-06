import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FollowStats = {
  userId: string;
  followers: number;
  following: number;
  checkins: number;
  isFollowing: boolean;
  isMe: boolean;
};

export const getFollowStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<FollowStats> => {
    const { supabase, userId: me } = context;
    const target = data.userId;

    const [followersRes, followingRes, checkinsRes, isFollowingRes] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", target),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", target),
      supabase.from("checkins").select("*", { count: "exact", head: true }).eq("user_id", target),
      me === target
        ? Promise.resolve({ data: null })
        : supabase
            .from("follows")
            .select("id")
            .eq("follower_id", me)
            .eq("following_id", target)
            .maybeSingle(),
    ]);

    return {
      userId: target,
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      checkins: checkinsRes.count ?? 0,
      isFollowing: !!(isFollowingRes as any)?.data,
      isMe: me === target,
    };
  });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: me } = context;
    if (me === data.userId) throw new Error("Você não pode seguir a si mesmo.");
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: me, following_id: data.userId });
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);

    // Notify (non-fatal)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("display_name, username")
        .eq("id", me)
        .maybeSingle();
      const name = prof?.username ? `@${prof.username}` : prof?.display_name ?? "Alguém";
      await supabaseAdmin.from("notifications").insert({
        user_id: data.userId,
        actor_id: me,
        kind: "follow",
        title: `👥 ${name} começou a te seguir!`,
        link: `/profile/${me}`,
        source_type: "follow",
        source_id: me,
      });
    } catch {
      /* non-fatal */
    }
    return { ok: true };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId: me } = context;
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", me)
      .eq("following_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type FollowListRow = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
};

export const listFollows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        kind: z.enum(["followers", "following"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<FollowListRow[]> => {
    const { supabase } = context;
    const col = data.kind === "followers" ? "following_id" : "follower_id";
    const otherCol = data.kind === "followers" ? "follower_id" : "following_id";
    const { data: rows, error } = await supabase
      .from("follows")
      .select("follower_id, following_id, created_at")
      .eq(col, data.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r[otherCol]);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", ids);
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return (rows ?? [])
      .map((r: any) => {
        const p = map.get(r[otherCol]);
        if (!p) return null;
        return {
          user_id: p.id,
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
          created_at: r.created_at,
        };
      })
      .filter(Boolean) as FollowListRow[];
  });

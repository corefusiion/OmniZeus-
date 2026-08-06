import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MemberOption = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

export const listChallengeMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<MemberOption[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("list_challenge_members_v2", {
      _challenge_id: data.challengeId,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      user_id: r.user_id as string,
      display_name: r.display_name as string,
      username: r.username as string | null,
      avatar_url: r.avatar_url as string | null,
    }));
  });


export type H2HSideStats = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  total_points: number;
  counted_days: number;
  total_minutes: number;
  current_streak: number;
  longest_streak: number;
  days_this_week: number;
  cumulative: { date: string; points: number }[];
};

export const getHeadToHead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        userA: z.string().uuid(),
        userB: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.userA === data.userB) throw new Error("Escolha dois membros diferentes.");

    const [profilesRes, memberRes, checkinsRes, challengeRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", [data.userA, data.userB]),
      supabase
        .from("challenge_members")
        .select("user_id, current_streak, longest_streak")
        .eq("challenge_id", data.challengeId)
        .in("user_id", [data.userA, data.userB]),
      supabase
        .from("checkins")
        .select("user_id, occurred_on, duration_min, points_awarded, over_limit")
        .eq("challenge_id", data.challengeId)
        .in("user_id", [data.userA, data.userB])
        .order("occurred_on", { ascending: true }),
      supabase
        .from("challenges")
        .select("name, starts_at, ends_at")
        .eq("id", data.challengeId)
        .maybeSingle(),
    ]);

    if (challengeRes.error || !challengeRes.data) throw new Error("Desafio não encontrado.");

    // Union of all dates for chart alignment
    const allDates = Array.from(new Set((checkinsRes.data ?? []).map((c) => c.occurred_on))).sort();

    const weekStart = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const day = d.getDay(); // 0=Sun
      const diff = (day + 6) % 7; // Monday-based
      d.setDate(d.getDate() - diff);
      return d.toISOString().slice(0, 10);
    })();

    function compute(userId: string): H2HSideStats {
      const profile = (profilesRes.data ?? []).find((p) => p.id === userId);
      const member = (memberRes.data ?? []).find((m) => m.user_id === userId);
      const ck = (checkinsRes.data ?? []).filter((c) => c.user_id === userId);
      let totalPoints = 0;
      let totalMinutes = 0;
      let daysThisWeek = 0;
      const dayPoints = new Map<string, number>();
      const countedSet = new Set<string>();
      for (const c of ck) {
        if (!c.over_limit) {
          totalPoints += c.points_awarded ?? 0;
          countedSet.add(c.occurred_on);
          if (c.occurred_on >= weekStart) daysThisWeek += 1;
        }
        totalMinutes += c.duration_min ?? 0;
        dayPoints.set(c.occurred_on, (dayPoints.get(c.occurred_on) ?? 0) + (c.over_limit ? 0 : c.points_awarded ?? 0));
      }
      let acc = 0;
      const cumulative = allDates.map((d) => {
        acc += dayPoints.get(d) ?? 0;
        return { date: d, points: acc };
      });
      // days_this_week counts distinct dates
      const weekDaysSet = new Set<string>();
      for (const c of ck) if (!c.over_limit && c.occurred_on >= weekStart) weekDaysSet.add(c.occurred_on);
      return {
        user_id: userId,
        display_name: profile?.display_name ?? "—",
        username: profile?.username ?? null,
        avatar_url: profile?.avatar_url ?? null,
        total_points: totalPoints,
        counted_days: countedSet.size,
        total_minutes: totalMinutes,
        current_streak: member?.current_streak ?? 0,
        longest_streak: member?.longest_streak ?? 0,
        days_this_week: weekDaysSet.size,
        cumulative,
      };
    }

    return {
      challenge: challengeRes.data,
      a: compute(data.userA),
      b: compute(data.userB),
    };
  });

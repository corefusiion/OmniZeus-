import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChallengeRole = "owner" | "co_admin" | "member" | "super_admin";

export type MiniRankRow = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  total_points: number;
  counted_days: number;
};

export type ChallengeHubPayload = {
  challenge: {
    id: string;
    name: string;
    description: string | null;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
    max_days_per_week: number;
    streak_bonus_points: number;
    checkin_cooldown_min: number;
    duration_bonus_step_min: number;
    duration_bonus_cap_pct: number;
    tiebreak_duration_cap_min: number;
    invite_code: string | null;
    invite_enabled: boolean;
    owner_id: string | null;
    is_public: boolean;
    city: string | null;
    banner_url: string | null;
  };
  role: ChallengeRole | null;
  is_super_admin: boolean;
  stats: {
    total_checkins: number;
    active_days: number;
    participants: number;
    avg_per_day: number;
    days_elapsed: number;
    days_total: number;
    days_remaining: number;
    progress_pct: number;
  };
  top_ranking: MiniRankRow[];
  financials: {
    entry_fee: number;
    currency: string;
    prize_split: { position: number; percent: number }[];
    participants_paid: number;
    participants_total: number;
    pot_total: number;
  } | null;
  my_streak: {
    current: number;
    longest: number;
    last_date: string | null;
    checked_in_today: boolean;
  };
};

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export const getChallengeHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ChallengeHubPayload> => {
    const { supabase, userId } = context;

    // Check platform roles first — super_admin can load any challenge via RLS,
    // even those they aren't a member of.
    const [{ data: isSuperAdmin }, { data: isPlatformSuperAdmin }] = await Promise.all([
      (supabase as any).rpc("has_role", { _user_id: userId, _role: "admin" }),
      (supabase as any).rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);

    const challengeSelect =
      "id, name, description, starts_at, ends_at, is_active, max_days_per_week, streak_bonus_points, checkin_cooldown_min, duration_bonus_step_min, duration_bonus_cap_pct, tiebreak_duration_cap_min, invite_code, invite_enabled, owner_id, entry_fee, currency, prize_split, is_public, city, banner_url";

    const { data: challenge, error: cErr } = await (supabase as any)
      .from("challenges")
      .select(challengeSelect)
      .eq("id", data.challengeId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!challenge) throw new Error("Desafio não encontrado.");

    // Papel do usuário
    const { data: memberRow } = await (supabase as any)
      .from("challenge_members")
      .select("role")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .maybeSingle();

    let role: ChallengeRole | null = null;
    if (memberRow?.role === "owner" || challenge.owner_id === userId) role = "owner";
    else if (memberRow?.role === "co_admin") role = "co_admin";
    else if (memberRow?.role === "member") role = "member";
    if (isSuperAdmin && role == null) role = "super_admin";

    // My streak
    const { data: myMember } = await (supabase as any)
      .from("challenge_members")
      .select("current_streak, longest_streak, last_checkin_date")
      .eq("challenge_id", challenge.id)
      .eq("user_id", userId)
      .maybeSingle();
    const todayIso = new Date().toISOString().slice(0, 10);
    const myStreak = {
      current: (myMember?.current_streak as number | undefined) ?? 0,
      longest: (myMember?.longest_streak as number | undefined) ?? 0,
      last_date: (myMember?.last_checkin_date as string | null | undefined) ?? null,
      checked_in_today: myMember?.last_checkin_date === todayIso,
    };

    const isAdminOfChallenge =
      role === "owner" || role === "co_admin" || isSuperAdmin === true;

    // Check-ins agregados
    const { data: checkins, error: chErr } = await supabase
      .from("checkins")
      .select("user_id, occurred_on, points_awarded, over_limit, ai_validated")
      .eq("challenge_id", challenge.id);
    if (chErr) throw new Error(chErr.message);

    const valid = (checkins ?? []).filter((c: any) => c.ai_validated !== "rejected");
    const totalCheckins = valid.length;
    const activeDaysSet = new Set(valid.map((c: any) => c.occurred_on));
    const activeDays = activeDaysSet.size;

    // Agregação por usuário (para top ranking)
    type Agg = { total: number; days: Set<string> };
    const byUser = new Map<string, Agg>();
    valid.forEach((c: any) => {
      let a = byUser.get(c.user_id);
      if (!a) {
        a = { total: 0, days: new Set() };
        byUser.set(c.user_id, a);
      }
      a.total += c.points_awarded ?? 0;
      if (!c.over_limit) a.days.add(c.occurred_on);
    });

    // Membros do desafio (+ bonus_points para somar no ranking)
    const { data: membersRows } = await (supabase as any)
      .from("challenge_members")
      .select("user_id, bonus_points")
      .eq("challenge_id", challenge.id);
    const memberUserIds = (membersRows ?? []).map((m: any) => m.user_id);
    let botMemberIds = new Set<string>();
    if (memberUserIds.length) {
      const { data: botProfiles } = await supabase
        .from("profiles")
        .select("id, is_bot")
        .in("id", memberUserIds)
        .eq("is_bot", true);
      botMemberIds = new Set((botProfiles ?? []).map((p: any) => p.id));
    }
    const participants = memberUserIds.filter((id: string) => !botMemberIds.has(id)).length;
    (membersRows ?? []).forEach((m: any) => {
      const bp = m.bonus_points ?? 0;
      if (!bp) return;
      let a = byUser.get(m.user_id);
      if (!a) {
        a = { total: 0, days: new Set() };
        byUser.set(m.user_id, a);
      }
      a.total += bp;
    });


    // Top ranking (top 5)
    const userIds = Array.from(byUser.keys());
    const profilesById = new Map<string, any>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, is_bot")
        .in("id", userIds);
      (profiles ?? []).forEach((p: any) => profilesById.set(p.id, p));
    }

    const topRanking: MiniRankRow[] = Array.from(byUser.entries())
      .map(([uid, a]) => {
        const p = profilesById.get(uid);
        return {
          user_id: uid,
          display_name: p?.display_name ?? "Sem nome",
          username: p?.username ?? null,
          avatar_url: p?.avatar_url ?? null,
          is_bot: !!p?.is_bot,
          total_points: a.total,
          counted_days: a.days.size,
        };
      })
      .filter((r: any) => !r.is_bot)
      .sort((a, b) => b.total_points - a.total_points || b.counted_days - a.counted_days)
      .slice(0, 5)
      .map(({ is_bot: _ignored, ...rest }: any) => rest);

    // Datas / progresso
    const start = new Date(`${challenge.starts_at}T00:00:00Z`);
    const end = new Date(`${challenge.ends_at}T23:59:59Z`);
    const now = new Date();
    const daysTotal = Math.max(1, daysBetween(start, end) + 1);
    const daysElapsed = Math.max(0, Math.min(daysTotal, daysBetween(start, now) + 1));
    const daysRemaining = Math.max(0, daysTotal - daysElapsed);
    const progressPct = Math.round((daysElapsed / daysTotal) * 100);
    const avgPerDay =
      daysElapsed > 0 ? +(totalCheckins / daysElapsed).toFixed(1) : 0;

    // Financials: só para admin do desafio ou super-admin global
    let financials: ChallengeHubPayload["financials"] = null;
    if (isAdminOfChallenge) {
      const { count: paidCount } = await (supabase as any)
        .from("challenge_participants")
        .select("*", { count: "exact", head: true })
        .eq("challenge_id", challenge.id)
        .eq("paid", true);
      const fee = Number(challenge.entry_fee ?? 0);
      const split = ((challenge.prize_split ?? []) as {
        position: number;
        percent: number;
      }[]).slice().sort((a, b) => a.position - b.position);
      const potBase = (paidCount ?? 0) > 0 ? paidCount! : participants;
      financials = {
        entry_fee: fee,
        currency: challenge.currency ?? "BRL",
        prize_split: split,
        participants_paid: paidCount ?? 0,
        participants_total: participants,
        pot_total: +(potBase * fee).toFixed(2),
      };
    }

    return {
      challenge: {
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        starts_at: challenge.starts_at,
        ends_at: challenge.ends_at,
        is_active: challenge.is_active,
        max_days_per_week: challenge.max_days_per_week,
        streak_bonus_points: challenge.streak_bonus_points,
        checkin_cooldown_min: challenge.checkin_cooldown_min,
        duration_bonus_step_min: challenge.duration_bonus_step_min,
        duration_bonus_cap_pct: challenge.duration_bonus_cap_pct,
        tiebreak_duration_cap_min: challenge.tiebreak_duration_cap_min,
        invite_code: challenge.invite_code,
        invite_enabled: challenge.invite_enabled,
        owner_id: challenge.owner_id,
        is_public: challenge.is_public ?? false,
        city: challenge.city ?? null,
        banner_url: challenge.banner_url ?? null,
      },
      role,
      is_super_admin: isPlatformSuperAdmin === true,
      stats: {
        total_checkins: totalCheckins,
        active_days: activeDays,
        participants,
        avg_per_day: avgPerDay,
        days_elapsed: daysElapsed,
        days_total: daysTotal,
        days_remaining: daysRemaining,
        progress_pct: progressPct,
      },
      top_ranking: topRanking,
      financials,
      my_streak: myStreak,
    };
  });

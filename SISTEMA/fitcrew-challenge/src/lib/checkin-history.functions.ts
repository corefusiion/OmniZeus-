import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckinHistoryRow = {
  id: string;
  challenge_id: string;
  occurred_on: string;
  created_at: string;
  duration_min: number;
  caption: string | null;
  source: string;
  exercise_id: string;
  exercise_name: string;
  exercise_icon: string | null;
  exercise_base_points: number;
  exercise_min_minutes: number;
  points_awarded: number;
  points_base: number;
  points_duration_bonus: number;
  points_streak_bonus: number;
  points_reason: string | null;
  over_limit: boolean;
  ai_validated: string | null;
  photo_flagged: boolean;
  photo_flag_reason: string | null;
  status: "valid" | "over_limit" | "rejected" | "pending_review";
};

export type CheckinHistoryPayload = {
  challenge: {
    id: string;
    name: string;
    checkin_cooldown_min: number;
    duration_bonus_step_min: number;
    duration_bonus_cap_pct: number;
    tiebreak_duration_cap_min: number;
    max_days_per_week: number;
    streak_bonus_points: number;
  };
  totals: {
    total_checkins: number;
    valid_checkins: number;
    over_limit: number;
    rejected: number;
    total_points: number;
  };
  rows: CheckinHistoryRow[];
};

export const getMyCheckinHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<CheckinHistoryPayload> => {
    const { supabase, userId } = context;

    const { data: challenge, error: cErr } = await (supabase as any)
      .from("challenges")
      .select(
        "id, name, max_days_per_week, streak_bonus_points, checkin_cooldown_min, duration_bonus_step_min, duration_bonus_cap_pct, tiebreak_duration_cap_min",
      )
      .eq("id", data.challengeId)
      .maybeSingle();
    if (cErr || !challenge) throw new Error("Desafio não encontrado.");

    const { data: checkins, error: chErr } = await (supabase as any)
      .from("checkins")
      .select(
        "id, challenge_id, occurred_on, created_at, duration_min, caption, source, exercise_type_id, points_awarded, points_base, points_duration_bonus, points_streak_bonus, points_reason, over_limit, ai_validated, photo_flagged, photo_flag_reason",
      )
      .eq("challenge_id", data.challengeId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (chErr) throw new Error(chErr.message);

    const exerciseIds = Array.from(
      new Set((checkins ?? []).map((c: any) => c.exercise_type_id).filter(Boolean)),
    );
    const exById = new Map<string, any>();
    if (exerciseIds.length) {
      const { data: exs } = await (supabase as any)
        .from("exercise_types")
        .select("id, name, icon, points, min_minutes")
        .in("id", exerciseIds);
      (exs ?? []).forEach((e: any) => exById.set(e.id, e));
    }

    const rows: CheckinHistoryRow[] = (checkins ?? []).map((c: any) => {
      const ex = exById.get(c.exercise_type_id) ?? {};
      let status: CheckinHistoryRow["status"] = "valid";
      if (c.ai_validated === "rejected") status = "rejected";
      else if (c.over_limit) status = "over_limit";
      else if (c.photo_flagged || c.ai_validated === "pending") status = "pending_review";
      return {
        id: c.id,
        challenge_id: c.challenge_id,
        occurred_on: c.occurred_on,
        created_at: c.created_at,
        duration_min: c.duration_min,
        caption: c.caption,
        source: c.source,
        exercise_id: c.exercise_type_id,
        exercise_name: ex.name ?? "Exercício",
        exercise_icon: ex.icon ?? null,
        exercise_base_points: ex.points ?? 0,
        exercise_min_minutes: ex.min_minutes ?? 0,
        points_awarded: c.points_awarded ?? 0,
        points_base: c.points_base ?? 0,
        points_duration_bonus: c.points_duration_bonus ?? 0,
        points_streak_bonus: c.points_streak_bonus ?? 0,
        points_reason: c.points_reason ?? null,
        over_limit: !!c.over_limit,
        ai_validated: c.ai_validated ?? null,
        photo_flagged: !!c.photo_flagged,
        photo_flag_reason: c.photo_flag_reason ?? null,
        status,
      };
    });

    const totals = {
      total_checkins: rows.length,
      valid_checkins: rows.filter((r) => r.status === "valid" || r.status === "pending_review").length,
      over_limit: rows.filter((r) => r.status === "over_limit").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      total_points: rows.reduce((a, r) => a + r.points_awarded, 0),
    };

    return {
      challenge: {
        id: (challenge as any).id,
        name: (challenge as any).name,
        checkin_cooldown_min: (challenge as any).checkin_cooldown_min ?? 30,
        duration_bonus_step_min: (challenge as any).duration_bonus_step_min ?? 15,
        duration_bonus_cap_pct: (challenge as any).duration_bonus_cap_pct ?? 50,
        tiebreak_duration_cap_min: (challenge as any).tiebreak_duration_cap_min ?? 120,
        max_days_per_week: (challenge as any).max_days_per_week,
        streak_bonus_points: (challenge as any).streak_bonus_points ?? 0,
      },
      totals,
      rows,
    };
  });

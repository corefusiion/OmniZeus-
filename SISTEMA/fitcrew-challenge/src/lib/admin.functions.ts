import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertChallengeAdmin(supabase: any, userId: string, challengeId: string) {
  const { data, error } = await supabase.rpc("is_challenge_admin", {
    _user_id: userId,
    _challenge_id: challengeId,
  });
  if (error || !data) throw new Error("Acesso restrito ao admin do desafio.");
}

async function assertExerciseChallengeAdmin(supabase: any, userId: string, exerciseId: string) {
  const { data } = await supabase.from("exercise_types").select("challenge_id").eq("id", exerciseId).maybeSingle();
  if (!data?.challenge_id) throw new Error("Exercício inexistente.");
  await assertChallengeAdmin(supabase, userId, data.challenge_id);
}

async function assertCheckinChallengeAdmin(supabase: any, userId: string, checkinId: string) {
  const { data } = await supabase.from("checkins").select("challenge_id").eq("id", checkinId).maybeSingle();
  if (!data?.challenge_id) throw new Error("Check-in inexistente.");
  await assertChallengeAdmin(supabase, userId, data.challenge_id);
}

const updateChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().max(500).nullable().optional(),
  maxDaysPerWeek: z.number().int().min(1).max(7),
  streakBonusPoints: z.number().int().min(0).max(50),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isActive: z.boolean(),
});

export const updateChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateChallengeSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertChallengeAdmin(context.supabase, context.userId, data.challengeId);
    const { error } = await context.supabase
      .from("challenges")
      .update({
        name: data.name,
        description: data.description ?? null,
        max_days_per_week: data.maxDaysPerWeek,
        streak_bonus_points: data.streakBonusPoints,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        is_active: data.isActive,
      })
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Regras: valor de entrada, premiação, desempate --------

const prizeSplitSchema = z
  .array(
    z.object({
      position: z.number().int().min(1).max(20),
      percent: z.number().min(0).max(100),
    }),
  )
  .min(1)
  .max(10)
  .refine((arr) => Math.round(arr.reduce((a, x) => a + x.percent, 0)) === 100, {
    message: "A soma dos percentuais precisa ser 100.",
  });

const tiebreakSchema = z
  .array(z.enum(["days", "duration", "first_to_reach", "weight_evolution", "daily_pose"]))
  .min(1)
  .max(5);

const updateRulesSchema = z.object({
  challengeId: z.string().uuid(),
  entryFee: z.number().min(0).max(1_000_000),
  currency: z.string().min(2).max(6).default("BRL"),
  prizeSplit: prizeSplitSchema,
  tiebreakers: tiebreakSchema,
  checkinCooldownMin: z.number().int().min(0).max(240).optional(),
  durationBonusStepMin: z.number().int().min(5).max(120).optional(),
  durationBonusCapPct: z.number().int().min(0).max(200).optional(),
  tiebreakDurationCapMin: z.number().int().min(15).max(600).optional(),
  absencePenaltyPts: z.number().min(0).max(1000).optional(),
});

export const updateChallengeRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => updateRulesSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertChallengeAdmin(context.supabase, context.userId, data.challengeId);
    const patch: any = {
      entry_fee: data.entryFee,
      currency: data.currency,
      prize_split: data.prizeSplit,
      tiebreakers: data.tiebreakers,
    };
    if (data.checkinCooldownMin !== undefined) patch.checkin_cooldown_min = data.checkinCooldownMin;
    if (data.durationBonusStepMin !== undefined) patch.duration_bonus_step_min = data.durationBonusStepMin;
    if (data.durationBonusCapPct !== undefined) patch.duration_bonus_cap_pct = data.durationBonusCapPct;
    if (data.tiebreakDurationCapMin !== undefined) patch.tiebreak_duration_cap_min = data.tiebreakDurationCapMin;
    if (data.absencePenaltyPts !== undefined) patch.absence_penalty_pts = data.absencePenaltyPts;
    const { error } = await context.supabase
      .from("challenges")
      .update(patch)
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Participantes (marcação de pagamento manual) --------

export const toggleParticipantPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        userId: z.string().uuid(),
        paid: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertChallengeAdmin(context.supabase, context.userId, data.challengeId);
    const { error } = await context.supabase
      .from("challenge_participants")
      .upsert(
        {
          challenge_id: data.challengeId,
          user_id: data.userId,
          paid: data.paid,
        } as any,
        { onConflict: "challenge_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Exercícios --------

const upsertExerciseSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  challengeId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  icon: z.string().max(20).nullable().optional(),
  points: z.number().int().min(0).max(100),
  minMinutes: z.number().int().min(1).max(600),
  sortOrder: z.number().int().min(0).max(999),
});

export const upsertExerciseType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => upsertExerciseSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertChallengeAdmin(context.supabase, context.userId, data.challengeId);
    const payload = {
      challenge_id: data.challengeId,
      name: data.name,
      icon: data.icon ?? null,
      points: data.points,
      min_minutes: data.minMinutes,
      sort_order: data.sortOrder,
    };
    if (data.id) {
      const { error } = await context.supabase.from("exercise_types").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("exercise_types").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteExerciseType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertExerciseChallengeAdmin(context.supabase, context.userId, data.id);
    const { error } = await context.supabase.from("exercise_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Review de check-ins marcados pela IA --------

export const setCheckinValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        checkinId: z.string().uuid(),
        status: z.enum(["approved", "rejected", "needs_review"]),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertCheckinChallengeAdmin(context.supabase, context.userId, data.checkinId);
    const { data: existing } = await (context.supabase as any)
      .from("checkins")
      .select("challenge_id, photo_flag_codes, photo_flag_reason")
      .eq("id", data.checkinId)
      .maybeSingle();
    if (!existing?.challenge_id) throw new Error("Check-in inexistente.");
    const { error } = await (context.supabase as any)
      .from("checkins")
      .update({ ai_validated: data.status })
      .eq("id", data.checkinId);
    if (error) throw new Error(error.message);
    await (context.supabase as any).from("checkin_moderation_audit").insert({
      checkin_id: data.checkinId,
      challenge_id: existing.challenge_id,
      actor_id: context.userId,
      action: data.status,
      reasons: existing.photo_flag_codes ?? [],
      reasons_text: existing.photo_flag_reason ?? null,
      notes: data.notes ?? null,
    });
    return { ok: true };
  });



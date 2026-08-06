import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Monday of the week containing `d` (YYYY-MM-DD, local). */
function isoWeekStart(d: Date = new Date()): string {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  x.setDate(x.getDate() - diff);
  return x.toISOString().slice(0, 10);
}

function dayOfWeekSun0(d: Date = new Date()): number {
  return d.getDay(); // 0..6
}

export const getWeighInStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ch } = await supabase
      .from("challenges")
      .select("id, weigh_in_day_of_week, weigh_in_enabled")
      .eq("id", data.challengeId)
      .maybeSingle();

    if (!ch) throw new Error("Desafio não encontrado.");

    const { data: mem } = await supabase
      .from("challenge_members")
      .select("weigh_in_streak, longest_weigh_in_streak, last_weigh_in_week")
      .eq("challenge_id", data.challengeId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("height_cm, sex")
      .eq("id", userId)
      .maybeSingle();

    const weekOf = isoWeekStart();
    const prevWeek = (() => {
      const d = new Date(weekOf + "T00:00:00");
      d.setDate(d.getDate() - 7);
      return d.toISOString().slice(0, 10);
    })();

    const { data: currentRow } = await supabase
      .from("body_metrics_history")
      .select("id, weight_kg, bmi, mood, recorded_at")
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId)
      .eq("source", "weigh_in")
      .eq("week_of", weekOf)
      .maybeSingle();

    const { data: prevRow } = await supabase
      .from("body_metrics_history")
      .select("weight_kg")
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId)
      .eq("source", "weigh_in")
      .eq("week_of", prevWeek)
      .maybeSingle();

    const dow = dayOfWeekSun0();
    const isWeighInDay = ch.weigh_in_enabled && dow === ch.weigh_in_day_of_week;

    return {
      enabled: ch.weigh_in_enabled,
      weighInDay: ch.weigh_in_day_of_week,
      isWeighInDay,
      alreadyWeighedThisWeek: !!currentRow,
      currentWeight: currentRow?.weight_kg != null ? Number(currentRow.weight_kg) : null,
      currentBmi: currentRow?.bmi != null ? Number(currentRow.bmi) : null,
      previousWeight: prevRow?.weight_kg != null ? Number(prevRow.weight_kg) : null,
      heightCm: profile?.height_cm ?? null,
      sex: (profile?.sex as "male" | "female" | null) ?? null,
      streak: mem?.weigh_in_streak ?? 0,
      longestStreak: mem?.longest_weigh_in_streak ?? 0,
      weekOf,
    };
  });

export const recordWeighIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        weight_kg: z.number().min(20).max(400),
        mood: z.string().max(4).nullable().optional(),
        note: z.string().max(500).nullable().optional(),
        shareWithChallenge: z.boolean().default(false),
        source: z.enum(["manual", "bluetooth"]).default("manual"),
        body_fat_pct: z.number().min(3).max(60).nullable().optional(),
        muscle_mass_pct: z.number().min(20).max(80).nullable().optional(),
        water_pct: z.number().min(20).max(80).nullable().optional(),
        bone_mass_kg: z.number().min(0.5).max(10).nullable().optional(),
        visceral_fat: z.number().int().min(1).max(30).nullable().optional(),
        metabolic_age: z.number().int().min(10).max(100).nullable().optional(),
        waist_cm: z.number().min(30).max(250).nullable().optional(),
      })
      .parse(data),
  )

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ch } = await supabase
      .from("challenges")
      .select("weigh_in_enabled")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!ch?.weigh_in_enabled) throw new Error("Pesagem semanal desativada neste desafio.");

    const weekOf = isoWeekStart();

    const { data: profile } = await supabase
      .from("profiles")
      .select("height_cm, sex")
      .eq("id", userId)
      .maybeSingle();

    // BMI cheap re-calc
    const heightCm = profile?.height_cm ?? null;
    const bmi =
      heightCm && heightCm > 0
        ? +(data.weight_kg / Math.pow(heightCm / 100, 2)).toFixed(1)
        : null;

    // Upsert semana (uma pesagem por semana por desafio)
    const { data: existing } = await supabase
      .from("body_metrics_history")
      .select("id")
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId)
      .eq("source", "weigh_in")
      .eq("week_of", weekOf)
      .maybeSingle();

    // Only persist composition when it actually came from the scale.
    const composition = data.source === "bluetooth"
      ? {
          body_fat_pct: data.body_fat_pct ?? null,
          muscle_mass_pct: data.muscle_mass_pct ?? null,
          water_pct: data.water_pct ?? null,
          visceral_fat: data.visceral_fat ?? null,
          metabolic_age: data.metabolic_age ?? null,
        }
      : {};

    const waistPatch = data.waist_cm != null ? { waist_cm: data.waist_cm } : {};

    if (existing) {
      const { error } = await supabase
        .from("body_metrics_history")
        .update({
          weight_kg: data.weight_kg,
          mood: data.mood ?? null,
          note: data.note ?? null,
          bmi,
          shared_with_challenge: data.shareWithChallenge,
          ...composition,
          ...waistPatch,
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("body_metrics_history").insert({
        user_id: userId,
        challenge_id: data.challengeId,
        weight_kg: data.weight_kg,
        height_cm: heightCm,
        bmi,
        mood: data.mood ?? null,
        note: data.note ?? null,
        source: "weigh_in",
        week_of: weekOf,
        shared_with_challenge: data.shareWithChallenge,
        ...composition,
        ...waistPatch,
      });
      if (error) throw new Error(error.message);
    }


    return { ok: true, weekOf };
  });

export const setChallengeWeighInDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        dayOfWeek: z.number().int().min(0).max(6),
        enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_challenge_admin", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (!isAdmin) throw new Error("Somente o dono/co-admin pode alterar.");
    const { error } = await supabase
      .from("challenges")
      .update({ weigh_in_day_of_week: data.dayOfWeek, weigh_in_enabled: data.enabled })
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

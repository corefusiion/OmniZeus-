import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns the most recent body_metrics_history row that has composition
 * data (fat/muscle/water) for the authenticated user, plus profile sex.
 * Used by the "Composição" section in Progress.
 */
export const getLatestComposition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("sex, height_cm")
      .eq("id", userId)
      .maybeSingle();

    // Latest metric with any composition field
    const { data: rows } = await supabase
      .from("body_metrics_history")
      .select(
        "id, recorded_at, weight_kg, height_cm, bmi, body_fat_pct, muscle_mass_pct, water_pct, visceral_fat, metabolic_age, body_type, source, waist_cm",
      )
      .eq("user_id", userId)
      .or("body_fat_pct.not.is.null,muscle_mass_pct.not.is.null,water_pct.not.is.null")
      .order("recorded_at", { ascending: false })
      .limit(1);

    const latest = rows?.[0] ?? null;

    return {
      profile: {
        sex: (profile?.sex as "male" | "female" | null) ?? null,
        heightCm: profile?.height_cm ?? null,
      },
      latest: latest
        ? {
            id: latest.id,
            recordedAt: latest.recorded_at,
            weightKg: Number(latest.weight_kg),
            heightCm: latest.height_cm ?? null,
            bmi: latest.bmi != null ? Number(latest.bmi) : null,
            bodyFatPct: latest.body_fat_pct != null ? Number(latest.body_fat_pct) : null,
            musclePct: latest.muscle_mass_pct != null ? Number(latest.muscle_mass_pct) : null,
            waterPct: latest.water_pct != null ? Number(latest.water_pct) : null,
            visceralFat: latest.visceral_fat != null ? Number(latest.visceral_fat) : null,
            metabolicAge: latest.metabolic_age ?? null,
            bodyType: latest.body_type,
            source: latest.source,
            waistCm: latest.waist_cm != null ? Number(latest.waist_cm) : null,
          }
        : null,
    };
  });

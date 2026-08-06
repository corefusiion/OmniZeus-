import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { textChat } from "@/lib/ai-provider.server";


const PROMPT = `Você é um coach de composição corporal em PT-BR. Recebe métricas do usuário e deve gerar 2-3 frases motivacionais e específicas (máx 280 caracteres no total), sem tom clínico, sem prometer resultados, sem prescrever dieta ou remédio. Foque em pequenas ações práticas (treino, sono, hidratação, proteína) alinhadas ao objetivo.

Retorne APENAS JSON válido: {"narrative": string}`;

export const generateBodyGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        metricId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: metric, error } = await supabase
      .from("body_metrics_history")
      .select("id, weight_kg, height_cm, bmi, body_fat_pct, muscle_mass_pct, body_type")
      .eq("id", data.metricId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!metric) throw new Error("Métrica não encontrada.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("height_cm, sex")
      .eq("id", userId)
      .maybeSingle();

    const heightCm = metric.height_cm ?? profile?.height_cm ?? null;
    const sex = (profile?.sex as "male" | "female" | null) ?? null;
    const weight = Number(metric.weight_kg);
    const fatPct = metric.body_fat_pct != null ? Number(metric.body_fat_pct) : null;
    const musclePct = metric.muscle_mass_pct != null ? Number(metric.muscle_mass_pct) : null;
    const bmi = metric.bmi != null ? Number(metric.bmi) : null;

    // Ideal weight (Devine)
    let idealWeight: number | null = null;
    if (heightCm && heightCm > 130) {
      const inchesOver5ft = heightCm / 2.54 - 60;
      const base = sex === "female" ? 45.5 : 50;
      idealWeight = +(base + 2.3 * inchesOver5ft).toFixed(1);
    }

    // Target fat pct for healthy midpoint
    const targetFat = sex === "female" ? 25 : 18;
    const fatDelta = fatPct != null ? +(((fatPct - targetFat) / 100) * weight).toFixed(1) : null;

    const targetMuscle = sex === "female" ? 40 : 45;
    const muscleDelta =
      musclePct != null ? +(((targetMuscle - musclePct) / 100) * weight).toFixed(1) : null;

    const weightDelta = idealWeight != null ? +(idealWeight - weight).toFixed(1) : null;

    // Cache: check if we already have goals for this metric
    const { data: existing } = await supabase
      .from("body_composition_goals")
      .select("id, narrative, ideal_weight_kg, weight_delta_kg, fat_delta_kg, muscle_delta_kg, bmi, body_type_key")
      .eq("metric_id", data.metricId)
      .maybeSingle();

    if (existing?.narrative) {
      return {
        idealWeightKg: existing.ideal_weight_kg != null ? Number(existing.ideal_weight_kg) : null,
        weightDeltaKg: existing.weight_delta_kg != null ? Number(existing.weight_delta_kg) : null,
        fatDeltaKg: existing.fat_delta_kg != null ? Number(existing.fat_delta_kg) : null,
        muscleDeltaKg: existing.muscle_delta_kg != null ? Number(existing.muscle_delta_kg) : null,
        bmi: existing.bmi != null ? Number(existing.bmi) : bmi,
        narrative: existing.narrative,
      };
    }

    // Call configured AI provider for narrative (falls back silently on error)
    let narrative =
      "Continue firme com pequenas ações consistentes: treino de força, sono de qualidade e proteína em cada refeição.";
    try {
      const userText = `Peso: ${weight} kg. IMC: ${bmi ?? "—"}. Gordura: ${fatPct ?? "—"}%. Músculo: ${musclePct ?? "—"}%. Peso ideal estimado: ${idealWeight ?? "—"} kg. Δ Peso: ${weightDelta ?? "—"} kg. Δ Gordura a reduzir: ${fatDelta ?? "—"} kg. Δ Músculo a ganhar: ${muscleDelta ?? "—"} kg. Sexo: ${sex ?? "—"}.`;
      const text = await textChat(
        [
          { role: "system", content: PROMPT },
          { role: "user", content: userText },
        ],
        { responseFormat: { type: "json_object" } },
      );
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed?.narrative) narrative = String(parsed.narrative).slice(0, 400);
        } catch {
          /* silent — narrative fallback stays */
        }
      }
    } catch {
      /* silent — narrative fallback stays */
    }


    const bodyTypeKey = (metric.body_type as string | null) ?? null;

    await supabase.from("body_composition_goals").insert({
      user_id: userId,
      metric_id: metric.id,
      ideal_weight_kg: idealWeight,
      weight_delta_kg: weightDelta,
      fat_delta_kg: fatDelta,
      muscle_delta_kg: muscleDelta,
      bmi,
      body_type_key: bodyTypeKey,
      narrative,
    });

    return {
      idealWeightKg: idealWeight,
      weightDeltaKg: weightDelta,
      fatDeltaKg: fatDelta,
      muscleDeltaKg: muscleDelta,
      bmi,
      narrative,
    };
  });

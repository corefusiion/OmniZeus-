import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { textChat } from "@/lib/ai-provider.server";


const sexSchema = z.enum(["M", "F"]).nullable().optional();

const metricsSchema = z.object({
  weight_kg: z.number().min(20).max(400),
  height_cm: z.number().int().min(80).max(260).nullable().optional(),
  sex: sexSchema,
});

function calcBMI(weight: number, heightCm: number | null | undefined) {
  if (!heightCm || heightCm <= 0) return null;
  const h = heightCm / 100;
  return +(weight / (h * h)).toFixed(1);
}

function bmiLabel(bmi: number | null) {
  if (bmi == null) return null;
  if (bmi < 18.5) return "abaixo do peso";
  if (bmi < 25) return "peso ideal";
  if (bmi < 30) return "sobrepeso";
  return "obesidade";
}

// Mifflin-St Jeor: TMB = 10*peso + 6.25*altura - 5*idade + s (M:+5, F:-161)
// Idade estimada em 30 anos quando ausente.
function calcBMR(
  weight: number,
  heightCm: number | null | undefined,
  sex: "M" | "F" | null | undefined,
) {
  if (!heightCm) return null;
  const age = 30;
  const s = sex === "M" ? 5 : sex === "F" ? -161 : -78; // neutro se desconhecido
  return Math.round(10 * weight + 6.25 * heightCm - 5 * age + s);
}


async function generateMotivationText(params: {
  delta: number | null;
  weight: number;
  bmi: number | null;
  bmr: number | null;
  daysSinceLast: number | null;
}): Promise<string> {
  const fallback = (() => {
    const { delta } = params;
    if (delta == null) return "Registrar é o primeiro passo. Bora manter a constância!";
    if (Math.abs(delta) < 0.3) return "Peso estável — sinal de disciplina. Continue firme!";
    if (delta < 0) return `Menos ${Math.abs(delta).toFixed(1)} kg desde a última medição. Progresso é isso! 🔥`;
    return `Ganho de ${delta.toFixed(1)} kg — se é massa magra, é vitória. Foco na consistência! 💪`;
  })();

  const prompt = `Você é um coach amigável em pt-BR. Gere UMA mensagem curta e elegante (máximo 2 frases, sem emojis excessivos, no máximo 2) para um usuário que registrou:
- Peso atual: ${params.weight} kg${params.delta != null ? ` (variação: ${params.delta >= 0 ? "+" : ""}${params.delta.toFixed(1)} kg vs. última medição${params.daysSinceLast ? ` há ${params.daysSinceLast} dias` : ""})` : ""}
${params.bmi != null ? `- IMC: ${params.bmi} (${bmiLabel(params.bmi)})` : ""}
${params.bmr != null ? `- Metabolismo basal estimado: ${params.bmr} kcal/dia` : ""}

Seja motivador, respeitoso, sem tom clínico. Retorne SÓ a mensagem, sem aspas.`;

  const text = await textChat([{ role: "user", content: prompt }]);
  return text || fallback;
}


export const recordBodyMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => metricsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Buscar profile atual + último registro
    const [profileRes, lastRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("weight_kg, height_cm, sex, display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("body_metrics_history")
        .select("weight_kg, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const heightCm = data.height_cm ?? profileRes.data?.height_cm ?? null;
    const sex = (data.sex ?? profileRes.data?.sex ?? null) as "M" | "F" | null;
    const bmi = calcBMI(data.weight_kg, heightCm);
    const bmr = calcBMR(data.weight_kg, heightCm, sex);

    const previousWeight = lastRes.data?.weight_kg != null ? Number(lastRes.data.weight_kg) : null;
    const delta = previousWeight != null ? +(data.weight_kg - previousWeight).toFixed(1) : null;
    const daysSinceLast = lastRes.data?.recorded_at
      ? Math.max(1, Math.round((Date.now() - new Date(lastRes.data.recorded_at).getTime()) / 86_400_000))
      : null;

    // Insere histórico
    await supabase.from("body_metrics_history").insert({
      user_id: userId,
      weight_kg: data.weight_kg,
      height_cm: heightCm,
      sex,
      bmi,
      bmr,
    });

    // Atualiza profile (inclui sex se informado)
    const profileUpdate: {
      weight_kg: number;
      height_cm: number | null;
      metrics_updated_at: string;
      sex?: "M" | "F";
    } = {
      weight_kg: data.weight_kg,
      height_cm: heightCm,
      metrics_updated_at: new Date().toISOString(),
    };
    if (data.sex === "M" || data.sex === "F") profileUpdate.sex = data.sex;

    await supabase.from("profiles").update(profileUpdate).eq("id", userId);


    // Post automático — sempre publica no feed
    const motivation = await generateMotivationText({
      delta,
      weight: data.weight_kg,
      bmi,
      bmr,
      daysSinceLast,
    });

    const deltaLine =
      delta == null
        ? "🎯 Primeira medição registrada!"
        : delta === 0
        ? "➖ Peso estável desde a última medição"
        : delta < 0
        ? `📉 ${Math.abs(delta).toFixed(1)} kg a menos${daysSinceLast ? ` (${daysSinceLast} dias)` : ""}`
        : `📈 ${delta.toFixed(1)} kg a mais${daysSinceLast ? ` (${daysSinceLast} dias)` : ""}`;

    const lines = [
      "✨ Atualização de métricas",
      "",
      `⚖️  Peso: ${data.weight_kg} kg${previousWeight != null ? `  (antes: ${previousWeight} kg)` : ""}`,
      heightCm ? `📏 Altura: ${heightCm} cm` : null,
      bmi != null ? `📊 IMC: ${bmi} — ${bmiLabel(bmi)}` : null,
      bmr != null ? `🔥 Metabolismo basal: ~${bmr} kcal/dia` : null,
      "",
      deltaLine,
      "",
      motivation,
    ].filter(Boolean);

    const body = lines.join("\n");

    const { data: inserted } = await supabase
      .from("posts")
      .insert({ user_id: userId, body })
      .select("id")
      .single();
    const postId = inserted?.id ?? null;


    return { ok: true, postId, bmi, bmr, delta };
  });

export const skipInitialMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("profiles")
      .update({ metrics_updated_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { ok: true };
  });

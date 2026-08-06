import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatCompletion } from "@/lib/ai-provider.server";


async function signedUrl(supabase: any, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("body-scan-media").createSignedUrl(path, 60 * 5);
  return data?.signedUrl ?? null;
}

type ScanResult = {
  body_fat_pct: number;
  muscle_mass_pct: number;
  body_type: "magro" | "atletico" | "medio" | "acima_do_peso" | "obeso";
  notes: string[];
};

const AI_PROMPT = `Você é um analista de composição corporal. A partir de 2 fotos (frente e lado) e do peso/altura informados, ESTIME:
- body_fat_pct: percentual de gordura corporal (número entre 3 e 60)
- muscle_mass_pct: massa muscular relativa (número entre 20 e 60)
- body_type: um de "magro" | "atletico" | "medio" | "acima_do_peso" | "obeso"
- notes: 3 observações práticas em português, curtas (máx 100 caracteres cada), sem tom clínico

IMPORTANTE:
- Isto é uma estimativa educativa, não diagnóstico.
- Se as fotos forem inadequadas (rosto oculto, roupa larga, luz ruim, apenas rosto), retorne o valor "invalid": true e escreva o motivo em notes[0].
- Retorne APENAS JSON válido no formato:
{"body_fat_pct": number, "muscle_mass_pct": number, "body_type": string, "notes": string[], "invalid": boolean}`;

async function callVisionModel(params: {
  frontUrl: string;
  sideUrl: string;
  weight: number;
  height: number | null;
}): Promise<ScanResult & { invalid?: boolean }> {
  const userText = `Peso: ${params.weight} kg${params.height ? `, Altura: ${params.height} cm` : ""}. Analise as 2 fotos abaixo (frente e lado).`;

  const out = await chatCompletion({
    messages: [
      { role: "system", content: AI_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: params.frontUrl } },
          { type: "image_url", image_url: { url: params.sideUrl } },
        ],
      },
    ],
    responseFormat: { type: "json_object" },
  });

  const text = out.content;
  if (!text) throw new Error("Resposta vazia da IA.");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("A IA retornou formato inesperado.");
    parsed = JSON.parse(m[0]);
  }

  return {
    body_fat_pct: Number(parsed.body_fat_pct),
    muscle_mass_pct: Number(parsed.muscle_mass_pct),
    body_type: String(parsed.body_type ?? "medio") as ScanResult["body_type"],
    notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 3).map(String) : [],
    invalid: Boolean(parsed.invalid),
  };
}


export const analyzeBodyScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid().nullable().optional(),
        weight_kg: z.number().min(20).max(400),
        height_cm: z.number().int().min(80).max(260).nullable().optional(),
        photoFrontPath: z.string().min(1),
        photoSidePath: z.string().min(1),
        shareWithChallenge: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) rate-limit: 3 scans/mês
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const { count } = await supabase
      .from("body_metrics_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", "ai_scan")
      .gte("recorded_at", monthAgo.toISOString());
    if ((count ?? 0) >= 3) {
      throw new Error("Limite de 3 análises por mês atingido. Volte no próximo ciclo.");
    }

    // 2) validar propriedade dos paths
    if (!data.photoFrontPath.startsWith(`${userId}/`) || !data.photoSidePath.startsWith(`${userId}/`)) {
      throw new Error("Fotos inválidas.");
    }

    // 3) signed URLs curtas para a IA
    const [frontUrl, sideUrl] = await Promise.all([
      signedUrl(supabase, data.photoFrontPath),
      signedUrl(supabase, data.photoSidePath),
    ]);
    if (!frontUrl || !sideUrl) throw new Error("Não foi possível preparar as fotos.");

    // 4) IA
    const scan = await callVisionModel({
      frontUrl,
      sideUrl,
      weight: data.weight_kg,
      height: data.height_cm ?? null,
    });


    if (scan.invalid) {
      throw new Error(scan.notes[0] || "Fotos inadequadas. Envie fotos com corpo inteiro, luz boa e roupa justa.");
    }

    // 5) clamp para faixas plausíveis
    const bf = Math.max(3, Math.min(60, scan.body_fat_pct));
    const mm = Math.max(20, Math.min(60, scan.muscle_mass_pct));

    // 6) delta vs. primeiro scan (transformation badge)
    const { data: firstScan } = await supabase
      .from("body_metrics_history")
      .select("body_fat_pct")
      .eq("user_id", userId)
      .eq("source", "ai_scan")
      .order("recorded_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // 7) inserir
    const { data: profile } = await supabase
      .from("profiles")
      .select("height_cm")
      .eq("id", userId)
      .maybeSingle();
    const heightCm = data.height_cm ?? profile?.height_cm ?? null;
    const bmi =
      heightCm && heightCm > 0 ? +(data.weight_kg / Math.pow(heightCm / 100, 2)).toFixed(1) : null;

    const { data: inserted, error } = await supabase
      .from("body_metrics_history")
      .insert({
        user_id: userId,
        challenge_id: data.challengeId ?? null,
        weight_kg: data.weight_kg,
        height_cm: heightCm,
        bmi,
        body_fat_pct: bf,
        muscle_mass_pct: mm,
        body_type: scan.body_type,
        source: "ai_scan",
        photo_front_path: data.photoFrontPath,
        photo_side_path: data.photoSidePath,
        ai_notes: { notes: scan.notes },
        shared_with_challenge: data.shareWithChallenge,
      })
      .select("id, recorded_at")
      .single();
    if (error) throw new Error(error.message);

    // 8) badges
    await supabase.rpc("award_badge", {
      _user_id: userId,
      _slug: "first_scan",
      _challenge_id: data.challengeId ?? undefined,
    });
    if (firstScan?.body_fat_pct != null && bf <= Number(firstScan.body_fat_pct) - 3) {
      await supabase.rpc("award_badge", {
        _user_id: userId,
        _slug: "transformation",
        _challenge_id: data.challengeId ?? undefined,
      });
    }


    return {
      id: inserted!.id,
      body_fat_pct: bf,
      muscle_mass_pct: mm,
      body_type: scan.body_type,
      notes: scan.notes,
      delta_fat:
        firstScan?.body_fat_pct != null ? +(bf - Number(firstScan.body_fat_pct)).toFixed(1) : null,
    };
  });

export const listBodyScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("body_metrics_history")
      .select("id, recorded_at, weight_kg, body_fat_pct, muscle_mass_pct, body_type, ai_notes, photo_front_path, photo_side_path")
      .eq("user_id", userId)
      .eq("source", "ai_scan")
      .order("recorded_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    const paths = (data ?? []).flatMap((r) => [r.photo_front_path, r.photo_side_path].filter(Boolean) as string[]);
    const signedMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("body-scan-media")
        .createSignedUrls(paths, 60 * 60);
      (signed ?? []).forEach((s) => {
        if (s.signedUrl && s.path) signedMap.set(s.path, s.signedUrl);
      });
    }

    return {
      scans: (data ?? []).map((r) => ({
        ...r,
        photo_front_url: r.photo_front_path ? signedMap.get(r.photo_front_path) ?? null : null,
        photo_side_url: r.photo_side_path ? signedMap.get(r.photo_side_path) ?? null : null,
      })),
    };
  });


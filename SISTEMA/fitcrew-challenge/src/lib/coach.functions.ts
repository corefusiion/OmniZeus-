import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { textChat } from "@/lib/ai-provider.server";
import {
  CHECKIN_PROMPT,
  COACH_SYSTEM,
  IMAGE_ANALYSIS_PROMPT,
  OFF_TOPIC_PROMPT,
  POST_CLASSIFY_PROMPT,
} from "@/lib/coach-persona.server";


// -----------------------------------------------------------------------------
// Helpers (server-only)
// -----------------------------------------------------------------------------

async function getOrCreateCoach(supabaseAdmin: any): Promise<{
  id: string;
  username: string;
  display_name: string;
}> {
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, username, display_name")
    .eq("is_bot", true)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id,
      username: existing.username ?? "coach",
      display_name: existing.display_name ?? "Coach FitCrew",
    };
  }

  // Cria auth user idempotente
  const email = "coach@fitcrew.bot";
  let userId: string | null = null;
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: "Coach FitCrew" },
  });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else {
    // Já existe — busca via listUsers (simples)
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list?.users?.find((u: any) => u.email === email);
    if (found) userId = found.id;
  }
  if (!userId) throw new Error("Não foi possível criar o Coach.");

  await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: "Coach FitCrew",
        username: "coach",
        is_bot: true,
        bio: "Sou o mascote da crew. Fico de olho nos check-ins 👀",
      },
      { onConflict: "id" },
    );
  return { id: userId, username: "coach", display_name: "Coach FitCrew" };
}

async function callAI(payload: { messages: any[] }): Promise<string | null> {
  return await textChat(payload.messages as any);
}


function tryParseJson<T = any>(text: string | null): T | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Tenta achar primeiro objeto
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

// -----------------------------------------------------------------------------
// analyzeAndCommentCheckin
// -----------------------------------------------------------------------------

export const analyzeAndCommentCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ checkinId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;


    // Autorização: só o dono do check-in dispara isto
    const { data: ck } = await supabase
      .from("checkins")
      .select(
        "id, user_id, challenge_id, photo_url, caption, duration_min, exercise:exercise_types(name)",
      )
      .eq("id", data.checkinId)
      .maybeSingle();
    if (!ck) return { ok: false, reason: "not_found" as const };
    if ((ck as any).user_id !== userId) return { ok: false, reason: "forbidden" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Signed URL da foto pra IA baixar
    let imageUrl: string | null = null;
    if (ck.photo_url) {
      const { data: signed } = await supabaseAdmin.storage
        .from("checkin-photos")
        .createSignedUrl(ck.photo_url, 60 * 10);
      imageUrl = signed?.signedUrl ?? null;
    }

    // 1) Análise da imagem — a IA valida se é treino E se combina com o exercício declarado
    const declaredExercise = (ck.exercise as any)?.name ?? null;
    let analysis = {
      is_exercise: true,
      matches_declared: true,
      confidence: 0.5,
      detected: "atividade física",
      reason: "",
    };
    if (imageUrl) {
      const rawAnalysis = await callAI({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: IMAGE_ANALYSIS_PROMPT(declaredExercise) },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      });

      const parsed = tryParseJson<typeof analysis>(rawAnalysis);
      if (parsed && typeof parsed.is_exercise === "boolean") {
        analysis = { ...analysis, ...parsed };
      } else {
        console.warn("[coach] image analysis parse failed", {
          checkinId: ck.id,
          raw: rawAnalysis?.slice(0, 300) ?? null,
        });
      }
    }

    // 2) Decisão (mais decisiva — evita empurrar tudo pro admin):
    //    - Não é treino, conf ≥ 0.75 → REJEITA
    //    - Não bate com o exercício declarado, conf ≥ 0.80 → REJEITA
    //    - Não é treino OU mismatch com conf menor → REVISÃO do admin
    //    - Foto ok → APROVA (sobrescreve pré-flag de EXIF quando IA está segura)
    let validated: "approved" | "needs_review" | "rejected" = "approved";
    const conf = Number(analysis.confidence ?? 0);
    const notExercise = !analysis.is_exercise;
    const mismatch = analysis.matches_declared === false;
    if (notExercise && conf >= 0.75) {
      validated = "rejected";
    } else if (mismatch && conf >= 0.8) {
      validated = "rejected";
    } else if (notExercise || mismatch) {
      validated = "needs_review";
    }
    const updatePayload: any = {
      ai_validated: validated,
      ai_notes: `${analysis.detected} · conf ${conf.toFixed(2)}${mismatch ? " · não bate com " + (declaredExercise ?? "declarado") : ""}${analysis.reason ? " · " + analysis.reason : ""}`,
    };
    // Se rejeitado pela IA, zera pontos automaticamente
    if (validated === "rejected") {
      updatePayload.points_awarded = 0;
      updatePayload.points_base = 0;
      updatePayload.points_duration_bonus = 0;
      updatePayload.points_streak_bonus = 0;
      updatePayload.points_reason = "ai_rejected";
      updatePayload.over_limit = true;
    }
    await supabaseAdmin.from("checkins").update(updatePayload).eq("id", ck.id);

    // Audita a decisão automática
    if (validated !== "approved") {
      await (supabaseAdmin as any).from("checkin_moderation_audit").insert({
        checkin_id: ck.id,
        challenge_id: (ck as any).challenge_id ?? null,
        actor_id: null,
        action: validated === "rejected" ? "auto_rejected_ai" : "auto_needs_review_ai",
        reasons: ["vision_ai"],
        reasons_text: `${analysis.detected} · conf ${conf.toFixed(2)}`,
        notes: analysis.reason ?? null,
      });
    }

    // 3) Busca autor pra usar @username
    const { data: author } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", ck.user_id)
      .maybeSingle();

    // 4) Comentário do Coach
    const prompt = CHECKIN_PROMPT({
      username: author?.username ?? null,
      displayName: author?.display_name ?? "atleta",
      exercise: (ck.exercise as any)?.name ?? null,
      durationMin: ck.duration_min,
      caption: ck.caption,
      imageAnalysis: analysis,
    });
    const raw = await callAI({
      messages: [
        { role: "system", content: COACH_SYSTEM },
        { role: "user", content: prompt },
      ],
    });

    if (!raw) return { ok: false, reason: "ai_failed" as const };

    const coach = await getOrCreateCoach(supabaseAdmin);
    // insert idempotente (unique parcial impede 2ª tentativa)
    const { error: insErr } = await supabaseAdmin
      .from("checkin_comments")
      .insert({
        checkin_id: ck.id,
        user_id: coach.id,
        body: raw,
        is_bot: true,
      });
    if (insErr && !`${insErr.message}`.toLowerCase().includes("duplicate")) {
      console.error("[coach] insert checkin comment failed", insErr);
    }
    return { ok: true, validated, comment: raw };
  });

// -----------------------------------------------------------------------------
// classifyAndCommentPost
// -----------------------------------------------------------------------------

export const classifyAndCommentPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;


    const { data: post } = await supabase
      .from("posts")
      .select("id, user_id, body")
      .eq("id", data.postId)
      .maybeSingle();
    if (!post) return { ok: false, reason: "not_found" as const };
    if (post.user_id !== userId) return { ok: false, reason: "forbidden" as const };
    // Ignora posts automáticos de métricas (já vêm com "Atualização de métricas")
    if (post.body.startsWith("✨ Atualização de métricas")) {
      return { ok: true, skipped: "metrics_post" as const };
    }

    // Classificação
    const rawCls = await callAI({
      messages: [{ role: "user", content: POST_CLASSIFY_PROMPT(post.body) }],
    });

    const cls = tryParseJson<{ is_fitness: boolean; topic: string; reason: string }>(rawCls);
    if (!cls) return { ok: false, reason: "classify_failed" as const };
    // Só comenta quando é OFF-topic (evita spam em posts fitness normais)
    if (cls.is_fitness) return { ok: true, skipped: "on_topic" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: author } = await supabaseAdmin
      .from("profiles")
      .select("display_name, username")
      .eq("id", post.user_id)
      .maybeSingle();

    const raw = await callAI({
      messages: [
        { role: "system", content: COACH_SYSTEM },
        {
          role: "user",
          content: OFF_TOPIC_PROMPT({
            username: author?.username ?? null,
            displayName: author?.display_name ?? "atleta",
            body: post.body,
            topic: cls.topic,
            reason: cls.reason,
          }),
        },
      ],
    });

    if (!raw) return { ok: false, reason: "ai_failed" as const };

    const coach = await getOrCreateCoach(supabaseAdmin);
    const { error: insErr } = await supabaseAdmin
      .from("post_comments")
      .insert({
        post_id: post.id,
        user_id: coach.id,
        body: raw,
        is_bot: true,
      });
    if (insErr && !`${insErr.message}`.toLowerCase().includes("duplicate")) {
      console.error("[coach] insert post comment failed", insErr);
    }
    return { ok: true, comment: raw, topic: cls.topic };
  });

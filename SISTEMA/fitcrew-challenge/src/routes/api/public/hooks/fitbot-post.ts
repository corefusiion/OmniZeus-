import { createFileRoute } from "@tanstack/react-router";

/**
 * FitBot Content Engine.
 *
 * Fluxo:
 *  1. Recebe { theme } (um dos 7 slots de horário).
 *  2. Busca informação real na internet via Tavily.
 *  3. Passa o resultado para a IA (OpenAI/Gemini/etc) gerar o post.
 *  4. Gera imagem vertical (mobile) relacionada ao tema.
 *  5. Faz upload no bucket `post-media` e cria o post como FitBot.
 *
 * Chamado pelo pg_cron 7x por dia via /api/public/*. Requer header:
 *   apikey: <SUPABASE_PUBLISHABLE_KEY>
 */

type ThemeSlot =
  | "morning_motivation"
  | "workout_tip"
  | "healthy_lunch"
  | "sports_curiosity"
  | "afternoon_push"
  | "crew_highlight"
  | "recovery_sleep";

const THEMES: Record<
  ThemeSlot,
  { emoji: string; label: string; query: string; imagePrompt: string }
> = {
  morning_motivation: {
    emoji: "🌅",
    label: "Motivação matinal + clima",
    query: "notícia motivadora fitness e clima geral no Brasil hoje",
    imagePrompt:
      "vertical 9:16 fotografia de nascer do sol sobre pista de corrida ao ar livre, atleta se alongando, energia matinal, tons quentes, alta qualidade",
  },
  workout_tip: {
    emoji: "💪",
    label: "Dica de treino",
    query: "dica de treino de força ou hipertrofia baseada em ciência recente",
    imagePrompt:
      "vertical 9:16 fotografia de academia moderna, halteres e barra, iluminação dramática, foco em execução técnica, estilo editorial fitness",
  },
  healthy_lunch: {
    emoji: "🥗",
    label: "Receita fitness do almoço",
    query: "receita fitness proteica prática para almoço de hoje",
    imagePrompt:
      "vertical 9:16 fotografia gastronômica de prato fitness colorido rico em proteína, vista de cima, luz natural, apetitoso",
  },
  sports_curiosity: {
    emoji: "📊",
    label: "Curiosidade esportiva ou científica",
    query: "curiosidade recente de ciência do esporte ou fisiologia do exercício",
    imagePrompt:
      "vertical 9:16 imagem editorial de laboratório de fisiologia do esporte, atleta com sensores, gráficos e ciência, estética limpa",
  },
  afternoon_push: {
    emoji: "🏃",
    label: "Incentivo para treinar agora",
    query: "benefício de treinar no fim da tarde e como manter constância",
    imagePrompt:
      "vertical 9:16 fotografia de corredor em rua urbana no fim de tarde, luz dourada, movimento e determinação",
  },
  crew_highlight: {
    emoji: "🏆",
    label: "Destaque da crew",
    query: "importância de comunidade e crew para consistência no treino",
    imagePrompt:
      "vertical 9:16 fotografia de grupo diverso treinando junto ao ar livre, alta energia, sorrisos, comunidade fitness",
  },
  recovery_sleep: {
    emoji: "😴",
    label: "Recuperação e sono",
    query: "dica prática de recuperação muscular e sono para atletas amadores",
    imagePrompt:
      "vertical 9:16 fotografia noturna aconchegante, atleta relaxando, luz suave azulada, atmosfera de recuperação e descanso",
  },
};

export const Route = createFileRoute("/api/public/hooks/fitbot-post")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: { theme?: ThemeSlot } = {};
        try {
          payload = (await request.json()) as { theme?: ThemeSlot };
        } catch {
          /* empty body ok */
        }
        const theme = payload.theme && THEMES[payload.theme]
          ? payload.theme
          : ("workout_tip" as ThemeSlot);
        const spec = THEMES[theme];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { textChat, generateImage } = await import("@/lib/ai-provider.server");
        const { tavilySearch } = await import("@/lib/tavily.server");

        // 1) Buscar informação real
        let searchContext = "";
        try {
          const t = await tavilySearch(spec.query, { maxResults: 4 });
          const bits: string[] = [];
          if (t.answer) bits.push(`Resumo: ${t.answer}`);
          t.results.slice(0, 4).forEach((r, i) => {
            bits.push(`(${i + 1}) ${r.title}\n${r.content}`);
          });
          searchContext = bits.join("\n\n").slice(0, 3500);
        } catch (e) {
          searchContext = `(Sem acesso à busca — motivo: ${(e as Error).message})`;
        }

        // 2) Gerar corpo do post
        const body = await textChat(
          [
            {
              role: "system",
              content:
                "Você é o FitBot, mascote oficial do FitCrew. Com base na informação real da internet fornecida, crie um post curto, animado e sem cara de robô para o feed do app. Máximo 3 parágrafos + 3 a 5 hashtags no final. Tom: amigável, motivador e às vezes sarcástico. Português brasileiro. Nunca invente estatísticas específicas — se a busca não trouxer números, seja qualitativo. Não cite URLs.",
            },
            {
              role: "user",
              content: `Tema deste post: ${spec.emoji} ${spec.label}\n\nInformação real (Tavily):\n${searchContext}\n\nEscreva agora o post para o feed.`,
            },
          ],
          { temperature: 0.85 },
        );

        if (!body) {
          return Response.json(
            { ok: false, error: "IA não gerou texto do post." },
            { status: 502 },
          );
        }
        const safeBody = body.slice(0, 1990);

        // 3) Achar FitBot
        const { data: bot } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("is_bot", true)
          .limit(1)
          .maybeSingle();
        if (!bot) {
          return Response.json({ ok: false, error: "Perfil FitBot não encontrado." }, { status: 500 });
        }

        // 4) Gerar imagem vertical + upload
        let mediaPath: string | null = null;
        try {
          const b64 = await generateImage(
            `${spec.imagePrompt}. Contexto: ${spec.label}. Sem texto na imagem.`,
          );
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const path = `${bot.id}/fitbot-${theme}-${Date.now()}.png`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("post-media")
            .upload(path, bytes, {
              cacheControl: "3600",
              upsert: false,
              contentType: "image/png",
            });
          if (!upErr) mediaPath = path;
        } catch (e) {
          console.warn("[fitbot-post] image gen failed:", (e as Error).message);
        }

        // 5) Insert do post
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("posts")
          .insert({ user_id: bot.id, body: safeBody, media_url: mediaPath })
          .select("id")
          .single();
        if (insErr || !inserted) {
          return Response.json(
            { ok: false, error: insErr?.message ?? "Falha ao inserir post." },
            { status: 500 },
          );
        }

        return Response.json({
          ok: true,
          theme,
          post_id: inserted.id,
          has_image: !!mediaPath,
          preview: safeBody.slice(0, 200),
        });
      },
    },
  },
});

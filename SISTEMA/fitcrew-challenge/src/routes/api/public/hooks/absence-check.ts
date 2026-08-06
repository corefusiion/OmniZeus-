import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint diário: Sistema de Punição por Ausência.
 *
 * Regras (por desafio):
 *  1) Olha para "ontem". Se ontem estava dentro do período do desafio e o usuário
 *     não teve NENHUM check-in, marca uma falta.
 *  2) Se `challenges.absence_penalty_pts > 0`, desconta esse valor de
 *     `challenge_members.bonus_points` (o leaderboard já soma esse campo).
 *  3) Publica um post do Coach (IA) zoando o faltoso. Se a penalidade > 0, o
 *     roast menciona os pontos perdidos; se = 0, faz piada sem citar pontos.
 *  4) Idempotente: não processa duas vezes o mesmo (usuário, desafio, data).
 */
export const Route = createFileRoute("/api/public/hooks/absence-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { textChat } = await import("@/lib/ai-provider.server");

        // "Ontem" em America/Sao_Paulo
        const nowSP = new Date(
          new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
        );
        const yesterday = new Date(nowSP);
        yesterday.setDate(nowSP.getDate() - 1);
        const yISO = yesterday.toISOString().slice(0, 10);

        // Bot do Coach (para o autor do post)
        const { data: bot } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("is_bot", true)
          .limit(1)
          .maybeSingle();

        // Desafios ativos que englobam "ontem"
        const { data: challenges } = await supabaseAdmin
          .from("challenges")
          .select("id, name, starts_at, ends_at, absence_penalty_pts, is_active")
          .eq("is_active", true)
          .lte("starts_at", yISO)
          .gte("ends_at", yISO);

        let totalAbsences = 0;
        let totalPosts = 0;

        for (const ch of challenges ?? []) {
          const penalty = Number((ch as any).absence_penalty_pts ?? 0);

          // Membros que estavam ativos ontem (entraram até ontem)
          const { data: members } = await supabaseAdmin
            .from("challenge_members")
            .select("user_id, joined_at, paused_from, paused_until")
            .eq("challenge_id", ch.id);

          if (!members?.length) continue;

          const memberIds = members
            .filter((m: any) => {
              const joined = m.joined_at?.slice(0, 10);
              if (joined && joined > yISO) return false;
              // pausado ontem? pula
              if (m.paused_from && m.paused_until) {
                if (m.paused_from <= yISO && m.paused_until >= yISO) return false;
              }
              return true;
            })
            .map((m: any) => m.user_id);

          if (!memberIds.length) continue;

          // Quem bateu check-in ontem
          const { data: yChecks } = await supabaseAdmin
            .from("checkins")
            .select("user_id")
            .eq("challenge_id", ch.id)
            .eq("occurred_on", yISO)
            .in("user_id", memberIds);
          const present = new Set((yChecks ?? []).map((c: any) => c.user_id));
          const absentIds = memberIds.filter((id) => !present.has(id));
          if (!absentIds.length) continue;

          // Já processados (idempotência)
          const { data: alreadyLogged } = await supabaseAdmin
            .from("absences")
            .select("user_id")
            .eq("challenge_id", ch.id)
            .eq("absence_date", yISO)
            .in("user_id", absentIds);
          const done = new Set((alreadyLogged ?? []).map((a: any) => a.user_id));
          const toProcess = absentIds.filter((id) => !done.has(id));
          if (!toProcess.length) continue;

          // Nomes
          const { data: profs } = await supabaseAdmin
            .from("profiles")
            .select("id, display_name, username, is_bot")
            .in("id", toProcess);
          const profById = new Map<string, any>();
          (profs ?? []).forEach((p: any) => profById.set(p.id, p));

          for (const uid of toProcess) {
            const p = profById.get(uid);
            if (!p || p.is_bot) continue;
            const name = p.username ? "@" + p.username : p.display_name || "Alguém";

            // 1) log da falta (idempotente pela UNIQUE)
            const { data: absRow, error: absErr } = await supabaseAdmin
              .from("absences")
              .insert({
                user_id: uid,
                challenge_id: ch.id,
                absence_date: yISO,
                penalty_pts: penalty,
              })
              .select("id")
              .maybeSingle();
            if (absErr) continue;
            totalAbsences++;

            // 2) deduz pontos (se houver penalidade)
            if (penalty > 0) {
              const { data: mem } = await supabaseAdmin
                .from("challenge_members")
                .select("bonus_points")
                .eq("challenge_id", ch.id)
                .eq("user_id", uid)
                .maybeSingle();
              const current = Number((mem as any)?.bonus_points ?? 0);
              await supabaseAdmin
                .from("challenge_members")
                .update({ bonus_points: current - penalty })
                .eq("challenge_id", ch.id)
                .eq("user_id", uid);
            }

            // 3) Roast da IA
            const prompt =
              penalty > 0
                ? `Aja com sarcasmo divertido (sem ofender de verdade). O usuário ${name} faltou ao treino ontem no desafio "${ch.name}" e perdeu -${penalty} pontos. Faça uma piada curta (máx. 2 frases) sobre isso, em português brasileiro, com 1 emoji. Cite o nome e a perda de pontos.`
                : `Aja com sarcasmo divertido (sem ofender de verdade). O usuário ${name} faltou ao treino ontem no desafio "${ch.name}". Faça uma piada curta (máx. 2 frases) cobrando ele publicamente por ter ficado no sofá, em português brasileiro, com 1 emoji. NÃO mencione perda de pontos.`;

            let roast: string | null = null;
            try {
              roast = await textChat([
                {
                  role: "system",
                  content:
                    "Você é o FitBot, mascote do FitCrew. Escreva zoações leves, curtas e motivadoras em pt-BR. Nunca ataque a pessoa, apenas a preguiça.",
                },
                { role: "user", content: prompt },
              ]);
            } catch {
              /* fallback abaixo */
            }
            if (!roast) {
              roast =
                penalty > 0
                  ? `🛋️ ${name} faltou ontem e o sofá ganhou -${penalty} pts pra ele. Volta pro jogo!`
                  : `🛋️ ${name} sumiu ontem. O sofá é gostoso, mas o pódio é melhor. Bora hoje!`;
            }

            // 4) Publica no feed do desafio
            if (bot?.id) {
              const { data: post } = await supabaseAdmin
                .from("posts")
                .insert({
                  user_id: bot.id,
                  body: roast,
                  challenge_id: ch.id,
                  is_system: true,
                  system_kind: "absence_roast",
                })
                .select("id")
                .maybeSingle();

              if (post?.id && absRow?.id) {
                await supabaseAdmin
                  .from("absences")
                  .update({ post_id: post.id })
                  .eq("id", absRow.id);
              }
              totalPosts++;
            }
          }
        }

        return Response.json({
          ok: true,
          date: yISO,
          absences: totalAbsences,
          posts: totalPosts,
        });
      },
    },
  },
});

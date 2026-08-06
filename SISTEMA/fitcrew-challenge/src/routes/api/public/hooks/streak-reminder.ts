import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: dispara notificações às pessoas com streak ativa
 * que ainda não bateram check-in hoje.
 *
 * Chamado por pg_cron todo dia às 18h (horário do servidor).
 */
export const Route = createFileRoute("/api/public/hooks/streak-reminder")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const today = new Date().toISOString().slice(0, 10);

        const { data: members, error } = await supabaseAdmin
          .from("challenge_members")
          .select("user_id, challenge_id, current_streak, last_checkin_date, challenges(name, is_active)")
          .gt("current_streak", 0)
          .neq("last_checkin_date", today);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const rows = (members ?? []).filter(
          (m: any) => m.challenges?.is_active !== false,
        );

        // Evita spam: só uma notificação de streak_reminder por dia por (user, challenge)
        const notifications = rows.map((m: any) => ({
          user_id: m.user_id,
          actor_id: null,
          kind: "streak_reminder",
          source_type: "challenge",
          source_id: m.challenge_id,
          title: `🔥 ${m.current_streak} dias seguidos`,
          body: `Não quebre sua sequência em "${m.challenges?.name ?? "seu desafio"}". Bate o check-in de hoje!`,
          link: `/c/${m.challenge_id}`,
        }));

        let inserted = 0;
        for (const n of notifications) {
          // Verifica se já mandou hoje
          const { data: existing } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("user_id", n.user_id)
            .eq("kind", "streak_reminder")
            .eq("source_id", n.source_id)
            .gte("created_at", `${today}T00:00:00Z`)
            .maybeSingle();
          if (existing) continue;
          const { error: insErr } = await supabaseAdmin.from("notifications").insert(n);
          if (!insErr) inserted += 1;
        }

        return new Response(
          JSON.stringify({ ok: true, candidates: rows.length, inserted }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/metrics-monthly-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Cron autentica via apikey do Supabase (header)
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Cadência quinzenal: notifica quem não atualiza há ≥15 dias
        const threshold = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

        // Usuários com métricas não atualizadas há ≥15 dias (ou nunca)
        const { data: stale, error } = await supabaseAdmin
          .from("profiles")
          .select("id, display_name")
          .or(`metrics_updated_at.is.null,metrics_updated_at.lt.${threshold}`);

        if (error) {
          console.error("[metrics-monthly-reminder] profiles query failed", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const users = stale ?? [];
        if (users.length === 0) {
          return new Response(JSON.stringify({ ok: true, notified: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        // Evita notificar 2x no mesmo período quinzenal: procura notificações
        // do tipo metrics_reminder criadas nos últimos 13 dias
        const recentThreshold = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await supabaseAdmin
          .from("notifications")
          .select("user_id")
          .eq("kind", "metrics_reminder")
          .gt("created_at", recentThreshold);
        const alreadyNotified = new Set((recent ?? []).map((r: any) => r.user_id));

        const toNotify = users.filter((u: any) => !alreadyNotified.has(u.id));

        if (toNotify.length === 0) {
          return new Response(JSON.stringify({ ok: true, notified: 0, skipped: users.length }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const rows = toNotify.map((u: any) => ({
          user_id: u.id,
          kind: "metrics_reminder",
          source_type: "system",
          title: "Hora de atualizar suas métricas 💪",
          body: "Faz mais de 15 dias que você não registra peso. Atualize e a IA vai gerar um relatório da sua evolução para a crew!",
          link: "/settings",
        }));

        const { error: insErr } = await supabaseAdmin.from("notifications").insert(rows);
        if (insErr) {
          console.error("[metrics-monthly-reminder] insert failed", insErr);
          return new Response(JSON.stringify({ error: insErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ ok: true, notified: rows.length, skipped: users.length - rows.length }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});

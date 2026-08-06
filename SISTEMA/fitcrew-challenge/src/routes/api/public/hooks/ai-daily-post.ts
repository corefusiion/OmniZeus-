import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/ai-daily-post")({
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

        const { data: schedules } = await supabaseAdmin
          .from("ai_schedule_config")
          .select("id, prompt, requires_approval, name")
          .eq("is_active", true)
          .eq("kind", "daily_post");

        if (!schedules?.length) return Response.json({ ran: 0 });

        let created = 0;
        for (const s of schedules) {
          try {
            const body = await textChat([
              {
                role: "system",
                content:
                  "Você é o FitBot, mascote do FitCrew. Escreva conteúdo curto, motivador e em português brasileiro.",
              },
              { role: "user", content: s.prompt },
            ]);
            if (!body) continue;

            if (s.requires_approval) {
              await supabaseAdmin.from("ai_moderation_queue").insert({
                kind: "post",
                body,
                metadata: { schedule_id: s.id, schedule_name: s.name },
              });
            } else {
              const { data: bot } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("is_bot", true)
                .limit(1)
                .maybeSingle();
              if (bot) {
                await supabaseAdmin.from("posts").insert({ user_id: bot.id, body });
              }
            }
            await supabaseAdmin
              .from("ai_schedule_config")
              .update({ last_run_at: new Date().toISOString() })
              .eq("id", s.id);
            created++;
          } catch {
            /* ignore individual failures */
          }
        }
        return Response.json({ ran: created });
      },
    },
  },
});


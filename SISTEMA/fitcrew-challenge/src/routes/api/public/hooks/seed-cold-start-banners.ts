import { createFileRoute } from "@tanstack/react-router";

/**
 * Gera capas 16:9 para os desafios "cold start" administrados pelo FitBot
 * que ainda não têm banner_url. Idempotente: pula os que já têm capa.
 *
 * Requer header `apikey: <SUPABASE_PUBLISHABLE_KEY>`.
 */

const PROMPTS: Record<string, string> = {
  "Projeto Verão 1.0":
    "Cinematic fitness photo, beach at golden hour, silhouette of athletes training on the sand, warm orange and golden gradient, bold text overlay area at bottom, premium sports app cover, 16:9 landscape",
  "Salvador Minha P@rra":
    "Cinematic photo of Salvador Bahia skyline at sunset, Pelourinho silhouette, red and orange gradient sky, urban Brazilian energy, fitness motivation, premium app cover, 16:9 landscape",
  "Bora Bahêa Fitness":
    "Dynamic sports photo, blue and red and white tricolor Brazilian football colors, stadium energy, fitness and sport fusion, athletic silhouettes, premium app cover, 16:9 landscape",
  "Sub 50 Fitness":
    "Motivational fitness transformation photo, running shoes close-up on track, fresh green and teal gradient, determination and progress energy, clean modern sports app cover, 16:9 landscape",
  "Coroas em Alta 1.0":
    "Elegant fitness photo, mature athlete over 40 training, gold and deep navy blue gradient, crown symbol subtle overlay, powerful and experienced energy, premium lifestyle app cover, 16:9 landscape",
  "EveryFitness 1.0":
    "Diverse group of people training together outdoors, inclusive and colorful, orange purple gradient sky, community and joy energy, Brazilian fitness lifestyle, premium app cover, 16:9 landscape",
  "Seca de Janeiro 1.0":
    "January fresh start fitness photo, running at sunrise, blue and white clean gradient, new beginnings and determination, fresh crisp energy, premium sports app cover, 16:9 landscape",
  "Modo Besta Ativado":
    "Intense gym workout photo, heavy weights, dark dramatic lighting with orange fire accent, beast mode energy, aggressive and powerful, premium fitness app cover, 16:9 landscape",
  "Só as Brabas 1.0":
    "Strong women athletes training together, empowered and focused, purple pink gradient, girl power energy, modern premium fitness app cover, 16:9 landscape",
  "Sem Desculpa 1.0":
    "Rainy day outdoor workout, athlete training in the rain, dramatic dark sky with orange light break, no excuses grit and determination, cinematic premium sports cover, 16:9 landscape",
};

const BOT_ID = "e63c8e12-1858-4f2d-8552-09592a6f5f6a";

export const Route = createFileRoute("/api/public/hooks/seed-cold-start-banners")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { generateImage } = await import("@/lib/ai-provider.server");

        const { data: challenges, error } = await supabaseAdmin
          .from("challenges")
          .select("id, name, banner_url")
          .eq("owner_id", BOT_ID);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results: Array<{ name: string; ok: boolean; error?: string }> = [];

        for (const ch of challenges ?? []) {
          if (ch.banner_url) {
            results.push({ name: ch.name, ok: true, error: "skipped (has banner)" });
            continue;
          }
          const prompt = PROMPTS[ch.name];
          if (!prompt) {
            results.push({ name: ch.name, ok: false, error: "no prompt mapped" });
            continue;
          }
          try {
            const b64 = await generateImage(
              `${prompt}. No text, no letters, no watermark. Cinematic 16:9 aspect ratio.`,
            );
            const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            const path = `${ch.id}/${crypto.randomUUID()}.png`;
            const { error: upErr } = await supabaseAdmin.storage
              .from("challenge-banners")
              .upload(path, bytes, { contentType: "image/png", upsert: false });
            if (upErr) throw new Error(upErr.message);
            const { error: updErr } = await supabaseAdmin
              .from("challenges")
              .update({ banner_url: path })
              .eq("id", ch.id);
            if (updErr) throw new Error(updErr.message);
            results.push({ name: ch.name, ok: true });
          } catch (e) {
            results.push({ name: ch.name, ok: false, error: (e as Error).message });
          }
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { textChat } from "@/lib/ai-provider.server";


export type PokeStatusRow = {
  user_id: string;
  last_checkin_at: string | null;
  hours_since: number | null;
  is_slacking: boolean;
};

// -----------------------------------------------------------------------------
// getPokeStatus — used by UI to decide who can be poked
// -----------------------------------------------------------------------------
export const getPokeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ rows: PokeStatusRow[] }> => {
    const { supabase } = context;

    const { data: checkins, error } = await supabase
      .from("checkins")
      .select("user_id, created_at, over_limit")
      .eq("challenge_id", data.challengeId);
    if (error) throw new Error(error.message);

    const lastByUser = new Map<string, string>();
    for (const c of checkins ?? []) {
      if (c.over_limit) continue;
      const prev = lastByUser.get(c.user_id);
      if (!prev || c.created_at > prev) lastByUser.set(c.user_id, c.created_at);
    }

    const now = Date.now();
    const rows: PokeStatusRow[] = Array.from(lastByUser.entries()).map(
      ([user_id, iso]) => {
        const diffMs = now - new Date(iso).getTime();
        const hours = diffMs / 3_600_000;
        return {
          user_id,
          last_checkin_at: iso,
          hours_since: +hours.toFixed(1),
          is_slacking: hours > 24,
        };
      },
    );

    return { rows };
  });

// -----------------------------------------------------------------------------
// pokeUser — dispara o Roast do Coach FitCrew
// -----------------------------------------------------------------------------

const FALLBACK_ROASTS = [
  "Parece que o(a) @{{target}} achou que o desafio era pro verão de 2030. Faltou de novo! 😴 (a pedido de @{{poker}})",
  "Cadê o(a) @{{target}}? Já dá pra plantar batata no colchão dessa preguiça 🥔 (@{{poker}} mandou lembrança)",
  "Time procura @{{target}} — desaparecido(a) desde o último check-in. Se avistar, mande treinar! 🕵️ (delatado por @{{poker}})",
  "@{{target}}, o Wi-Fi tá bom, mas o supino tá reclamando saudade 🏋️ (@{{poker}} tá de olho)",
  "Alerta ⚠️: @{{target}} entrou em modo hibernação. @{{poker}} pediu pra você acordar!",
];

function pickFallback(target: string, poker: string): string {
  const tpl = FALLBACK_ROASTS[Math.floor(Math.random() * FALLBACK_ROASTS.length)];
  return tpl.replaceAll("{{target}}", target).replaceAll("{{poker}}", poker);
}

async function generateRoast(
  targetName: string,
  pokerName: string,
  hoursSince: number | null,
): Promise<string> {
  const hoursText =
    hoursSince == null
      ? "ainda não fez nenhum check-in"
      : hoursSince >= 48
        ? `está há ${Math.floor(hoursSince / 24)} dias sem treinar`
        : `está há ${Math.floor(hoursSince)}h sem treinar`;

  const prompt = `Você é o "Coach FitCrew", um personal trainer sarcástico e engraçado que provoca alunos preguiçosos no feed de um app fitness. Escreva UMA piada curta (máx 240 caracteres, 1 linha), em português brasileiro, com humor leve, sem ofensa pesada, sem xingamento, sem preconceito. Use emojis com moderação.

Contexto:
- Alvo: @${targetName} (${hoursText})
- Quem cutucou: @${pokerName}

Regras:
- SEMPRE mencione @${targetName} pelo menos uma vez.
- Termine com "(a pedido de @${pokerName})".
- Não use aspas, não use markdown, não use quebra de linha.
- Responda APENAS a piada, sem introdução.`;

  const text = await textChat([{ role: "user", content: prompt }]);
  if (!text) return pickFallback(targetName, pokerName);
  return text.length > 280 ? text.slice(0, 277) + "..." : text;
}


export const pokeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        targetId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (userId === data.targetId) {
      return { ok: false as const, reason: "self" as const };
    }

    // Alvo deve estar >24h sem check-in válido
    const { data: checkins } = await supabase
      .from("checkins")
      .select("created_at, over_limit")
      .eq("challenge_id", data.challengeId)
      .eq("user_id", data.targetId)
      .order("created_at", { ascending: false })
      .limit(20);

    const lastValid = (checkins ?? []).find((c) => !c.over_limit);
    const hoursSince = lastValid
      ? (Date.now() - new Date(lastValid.created_at).getTime()) / 3_600_000
      : null;
    if (hoursSince != null && hoursSince <= 24) {
      return { ok: false as const, reason: "not_slacking" as const };
    }

    // Nomes para o roast
    const [{ data: target }, { data: poker }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", data.targetId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const targetHandle =
      (target as any)?.username || (target as any)?.display_name || "amigo";
    const pokerHandle =
      (poker as any)?.username || (poker as any)?.display_name || "colega";

    const roast = await generateRoast(targetHandle, pokerHandle, hoursSince).catch(() =>
      pickFallback(targetHandle, pokerHandle),
    );

    // Publica via SECURITY DEFINER — anti-spam + inserts como Coach acontecem no RPC.
    const { data: rpc, error: rpcErr } = await (supabase as any).rpc("register_poke", {
      _challenge_id: data.challengeId,
      _target_id: data.targetId,
      _roast: roast,
    });
    if (rpcErr) {
      const msg = rpcErr.message ?? "Falha ao cutucar.";
      if (/já cutucou/i.test(msg)) return { ok: false as const, reason: "already_poked" as const };
      if (/bastante cutucado/i.test(msg)) return { ok: false as const, reason: "target_cap" as const };
      throw new Error(msg);
    }
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    const postId = row?.post_id as string | undefined;
    if (!postId) throw new Error("Falha ao publicar roast.");

    return { ok: true as const, postId, roast };
  });


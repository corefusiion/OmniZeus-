import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PrizeTier = "coin" | "points" | "troll";

export type Prize = {
  key: string;
  label: string;
  tier: PrizeTier;
  emoji: string;
  points: number; // pontos a creditar
  weight: number; // peso para sorteio
};

export const PRIZES: Prize[] = [
  // Moedas / itens virtuais
  { key: "gold_border_7d", label: "Borda Dourada no Avatar por 7 dias", tier: "coin", emoji: "🪙", points: 0, weight: 8 },
  { key: "diamond_emoji", label: "Emoji Exclusivo 💎", tier: "coin", emoji: "💎", points: 0, weight: 10 },
  { key: "forgiveness_ticket", label: "Ticket do Perdão (anula 1 falta)", tier: "coin", emoji: "🎟️", points: 0, weight: 6 },
  // Boost de pontos (fracionados, teto 2 pts)
  { key: "points_0_5", label: "+0,5 Ponto Bônus", tier: "points", emoji: "📊", points: 0.5, weight: 20 },
  { key: "points_0_7", label: "+0,7 Ponto Bônus", tier: "points", emoji: "⚡", points: 0.7, weight: 14 },
  { key: "points_1", label: "+1,0 Ponto Bônus", tier: "points", emoji: "🚀", points: 1.0, weight: 8 },
  { key: "points_2", label: "+2,0 Pontos Bônus", tier: "points", emoji: "💥", points: 2.0, weight: 3 },
  // Troll
  { key: "troll_highfive", label: "High-Five do Coach ✋ (0 pts)", tier: "troll", emoji: "✋", points: 0, weight: 12 },
  { key: "troll_shape", label: "Nada hoje — mas o shape tá vindo 💪", tier: "troll", emoji: "💪", points: 0, weight: 12 },
  { key: "troll_supino", label: "1kg imaginário a mais no Supino", tier: "troll", emoji: "🏋️", points: 0, weight: 8 },
];

function pickPrize(): Prize {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PRIZES[PRIZES.length - 1];
}

export type RouletteStatus = {
  shouldShow: boolean; // é segunda-feira E ainda não girou essa semana E desafio ativo
  alreadySpun: boolean;
  eligible: boolean;
  weekStart: string; // yyyy-mm-dd
  countedDays: number;
  requiredDays: number;
  existingPrize: { key: string; label: string; tier: PrizeTier; points: number } | null;
};

/** Status do giro para o desafio atual (chamado ao abrir a página do desafio). */
export const getRouletteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { challengeId: string }) => data)
  .handler(async ({ data, context }): Promise<RouletteStatus> => {
    const { supabase, userId } = context;

    // 1) Verifica se é segunda-feira (America/Sao_Paulo)
    const nowSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const isMonday = nowSP.getDay() === 1;

    // 2) Chama a função que calcula elegibilidade + week_start
    const { data: perfectRows, error: perfectErr } = await supabase.rpc("was_perfect_last_week", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (perfectErr) throw new Error(perfectErr.message);
    const perfect = Array.isArray(perfectRows) ? perfectRows[0] : perfectRows;
    if (!perfect) {
      return {
        shouldShow: false,
        alreadySpun: false,
        eligible: false,
        weekStart: "",
        countedDays: 0,
        requiredDays: 0,
        existingPrize: null,
      };
    }

    const weekStart: string = perfect.week_start;
    const eligible: boolean = perfect.eligible;
    const countedDays: number = perfect.counted_days ?? 0;
    const requiredDays: number = perfect.required_days ?? 0;

    // 3) Já girou?
    const { data: existing, error: exErr } = await supabase
      .from("roulette_spins")
      .select("prize_key, prize_label, prize_tier, points_awarded, spun_at")
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    const alreadySpun = !!existing?.spun_at;
    const existingPrize =
      existing && existing.prize_key
        ? {
            key: existing.prize_key,
            label: existing.prize_label ?? "",
            tier: (existing.prize_tier ?? "troll") as PrizeTier,
            points: existing.points_awarded ?? 0,
          }
        : null;

    return {
      shouldShow: isMonday && !alreadySpun && requiredDays > 0,
      alreadySpun,
      eligible,
      weekStart,
      countedDays,
      requiredDays,
      existingPrize,
    };
  });

/** Executa o giro (server-side). Retorna o prêmio. */
export const spinRoulette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { challengeId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: perfectRows, error: perfectErr } = await supabase.rpc("was_perfect_last_week", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (perfectErr) throw new Error(perfectErr.message);
    const perfect = Array.isArray(perfectRows) ? perfectRows[0] : perfectRows;
    if (!perfect) throw new Error("Desafio não encontrado.");

    const weekStart: string = perfect.week_start;
    const eligible: boolean = perfect.eligible;

    // Já girou? Retorna existente
    const { data: existing } = await supabase
      .from("roulette_spins")
      .select("prize_key, prize_label, prize_tier, points_awarded, spun_at, eligible")
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (existing?.spun_at) {
      return {
        alreadySpun: true,
        eligible: existing.eligible,
        prize: existing.prize_key
          ? {
              key: existing.prize_key,
              label: existing.prize_label ?? "",
              tier: (existing.prize_tier ?? "troll") as PrizeTier,
              points: existing.points_awarded ?? 0,
            }
          : null,
      };
    }

    if (!eligible) {
      // registra tentativa inelegível para não repetir
      await supabase.from("roulette_spins").upsert(
        {
          user_id: userId,
          challenge_id: data.challengeId,
          week_start: weekStart,
          eligible: false,
          spun_at: new Date().toISOString(),
        },
        { onConflict: "user_id,challenge_id,week_start" },
      );
      return { alreadySpun: false, eligible: false, prize: null };
    }

    // Sorteia server-side
    const prize = pickPrize();

    const { error: upErr } = await supabase.from("roulette_spins").upsert(
      {
        user_id: userId,
        challenge_id: data.challengeId,
        week_start: weekStart,
        eligible: true,
        prize_key: prize.key,
        prize_label: prize.label,
        prize_tier: prize.tier,
        points_awarded: prize.points,
        spun_at: new Date().toISOString(),
      },
      { onConflict: "user_id,challenge_id,week_start" },
    );
    if (upErr) throw new Error(upErr.message);

    // === Aplica o efeito real do prêmio ===
    try {
      if (prize.tier === "points" && prize.points > 0) {
        // soma pontos bônus no challenge_members deste desafio
        const { data: cm } = await supabase
          .from("challenge_members")
          .select("bonus_points")
          .eq("user_id", userId)
          .eq("challenge_id", data.challengeId)
          .maybeSingle();
        const current = (cm as { bonus_points?: number } | null)?.bonus_points ?? 0;
        await supabase
          .from("challenge_members")
          .update({ bonus_points: current + prize.points })
          .eq("user_id", userId)
          .eq("challenge_id", data.challengeId);
      } else if (prize.key === "gold_border_7d") {
        const untilIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("profiles")
          .update({ avatar_border_until: untilIso })
          .eq("id", userId);
      } else if (prize.key === "diamond_emoji") {
        const { data: prof } = await supabase
          .from("profiles")
          .select("unlocked_emojis")
          .eq("id", userId)
          .maybeSingle();
        const cur = ((prof as { unlocked_emojis?: string[] } | null)?.unlocked_emojis ?? []) as string[];
        if (!cur.includes("💎")) {
          await supabase
            .from("profiles")
            .update({ unlocked_emojis: [...cur, "💎"] })
            .eq("id", userId);
        }
      } else if (prize.key === "forgiveness_ticket") {
        const { data: cm } = await supabase
          .from("challenge_members")
          .select("forgiveness_tickets")
          .eq("user_id", userId)
          .eq("challenge_id", data.challengeId)
          .maybeSingle();
        const current = (cm as { forgiveness_tickets?: number } | null)?.forgiveness_tickets ?? 0;
        await supabase
          .from("challenge_members")
          .update({ forgiveness_tickets: current + 1 })
          .eq("user_id", userId)
          .eq("challenge_id", data.challengeId);
      }
    } catch (e) {
      // não faz rollback do giro se o efeito falhar; deixamos o prêmio registrado
      console.error("[roulette] failed to apply prize effect", e);
    }

    return {
      alreadySpun: false,
      eligible: true,
      prize: {
        key: prize.key,
        label: prize.label,
        tier: prize.tier,
        points: prize.points,
        emoji: prize.emoji,
      },
    };
  });


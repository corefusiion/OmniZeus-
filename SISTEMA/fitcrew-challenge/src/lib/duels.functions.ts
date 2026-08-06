import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Monday of current week (America/Sao_Paulo)
function currentWeekStartISO(): string {
  const now = new Date();
  // Convert to SP time approximation via UTC-3 (server tz-agnostic; only used for week bucket)
  const sp = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const day = sp.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(sp);
  monday.setUTCDate(sp.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}

export type DuelRow = {
  id: string;
  challenge_id: string;
  week_start: string;
  challenger_id: string;
  opponent_id: string;
  stake_points: number;
  status: "pending" | "accepted" | "declined" | "canceled" | "resolved";
  winner_id: string | null;
  tied: boolean;
  challenger_points: number | null;
  opponent_points: number | null;
  created_at: string;
  challenger: { display_name: string; username: string | null; avatar_url: string | null } | null;
  opponent: { display_name: string; username: string | null; avatar_url: string | null } | null;
};

export const listDuelsForChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ week_start: string; duels: DuelRow[] }> => {
    const { supabase } = context;
    const week_start = currentWeekStartISO();
    const { data: rows, error } = await supabase
      .from("duels")
      .select("*")
      .eq("challenge_id", data.challengeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set((rows ?? []).flatMap((d: any) => [d.challenger_id, d.opponent_id])),
    );
    const profileMap = new Map<string, any>();
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", ids);
      for (const p of profiles ?? []) profileMap.set(p.id, p);
    }

    const duels = (rows ?? []).map((d: any) => ({
      ...d,
      challenger: profileMap.get(d.challenger_id) ?? null,
      opponent: profileMap.get(d.opponent_id) ?? null,
    })) as DuelRow[];

    return { week_start, duels };
  });

export const createDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        opponentId: z.string().uuid(),
        stakePoints: z.number().int().min(1).max(5),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (userId === data.opponentId) throw new Error("Você não pode se desafiar.");

    const week_start = currentWeekStartISO();

    // Check for existing duel between this pair this week (unordered)
    const { data: existing } = await supabase
      .from("duels")
      .select("id, status")
      .eq("challenge_id", data.challengeId)
      .eq("week_start", week_start)
      .or(
        `and(challenger_id.eq.${userId},opponent_id.eq.${data.opponentId}),and(challenger_id.eq.${data.opponentId},opponent_id.eq.${userId})`,
      )
      .maybeSingle();

    if (existing) {
      throw new Error(
        existing.status === "pending"
          ? "Já existe um convite pendente entre vocês nesta semana."
          : "Vocês já têm um duelo nesta semana.",
      );
    }

    const { data: inserted, error } = await supabase
      .from("duels")
      .insert({
        challenge_id: data.challengeId,
        week_start,
        challenger_id: userId,
        opponent_id: data.opponentId,
        stake_points: data.stakePoints,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Notify opponent (admin client since no INSERT policy on notifications)
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [challengerProfile, challengeRow] = await Promise.all([
        supabaseAdmin.from("profiles").select("display_name, username").eq("id", userId).maybeSingle(),
        supabaseAdmin.from("challenges").select("name").eq("id", data.challengeId).maybeSingle(),
      ]);
      const name =
        challengerProfile.data?.username
          ? `@${challengerProfile.data.username}`
          : challengerProfile.data?.display_name ?? "Alguém";
      await supabaseAdmin.from("notifications").insert({
        user_id: data.opponentId,
        actor_id: userId,
        kind: "duel_invite",
        title: `⚔️ ${name} te desafiou apostando ${data.stakePoints} ${data.stakePoints === 1 ? "ponto" : "pontos"}! Vai fugir?`,
        body: challengeRow.data?.name ?? null,
        link: `/c/${data.challengeId}/ranking`,
        source_type: "duel",
        source_id: inserted.id,
      });
    } catch {
      /* non-fatal */
    }

    return { id: inserted.id, week_start };
  });

export const respondDuel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        duelId: z.string().uuid(),
        action: z.enum(["accept", "decline", "cancel"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: duel, error: fetchErr } = await supabase
      .from("duels")
      .select("*")
      .eq("id", data.duelId)
      .maybeSingle();
    if (fetchErr || !duel) throw new Error("Duelo não encontrado.");
    if (duel.status !== "pending") throw new Error("Este duelo não está mais pendente.");

    if (data.action === "cancel") {
      if (duel.challenger_id !== userId) throw new Error("Apenas o desafiante pode cancelar.");
      const { error } = await supabase
        .from("duels")
        .update({ status: "canceled" })
        .eq("id", data.duelId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    if (duel.opponent_id !== userId) throw new Error("Apenas o desafiado pode responder.");
    const newStatus = data.action === "accept" ? "accepted" : "declined";
    const { error } = await supabase
      .from("duels")
      .update({
        status: newStatus,
        accepted_at: data.action === "accept" ? new Date().toISOString() : null,
      })
      .eq("id", data.duelId);
    if (error) throw new Error(error.message);

    // Notify challenger
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle();
      const name = prof?.username ? `@${prof.username}` : prof?.display_name ?? "Oponente";
      await supabaseAdmin.from("notifications").insert({
        user_id: duel.challenger_id,
        actor_id: userId,
        kind: data.action === "accept" ? "duel_accepted" : "duel_declined",
        title:
          data.action === "accept"
            ? `🔥 ${name} aceitou seu duelo! Que comece a briga por ${duel.stake_points} pts.`
            : `😴 ${name} recusou o duelo. Fica pra próxima.`,
        link: `/c/${duel.challenge_id}/ranking`,
        source_type: "duel",
        source_id: duel.id,
      });
    } catch {
      /* non-fatal */
    }

    return { ok: true };
  });

/**
 * Lazily resolve accepted duels whose window is over (week_start + 7 days <= today).
 * Winner: higher sum of points_awarded (non-rejected checkins) within the window.
 * Awards the `duel_winner` badge and notifies both parties.
 * Safe to call on every ranking/duels page load.
 */
export const resolveExpiredDuels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString().slice(0, 10);

    const { data: pending } = await supabaseAdmin
      .from("duels")
      .select("*")
      .eq("challenge_id", data.challengeId)
      .eq("status", "accepted");

    let resolved = 0;
    for (const d of pending ?? []) {
      const weekStart = d.week_start as string;
      const startDate = new Date(`${weekStart}T00:00:00Z`);
      const endDate = new Date(startDate.getTime() + 7 * 24 * 3600 * 1000);
      const endIso = endDate.toISOString().slice(0, 10);
      if (endIso > nowIso) continue; // ainda em andamento

      // Somar pontos dos dois no período [week_start, endIso)
      const [chRes, opRes] = await Promise.all([
        supabaseAdmin
          .from("checkins")
          .select("points_awarded")
          .eq("challenge_id", d.challenge_id)
          .eq("user_id", d.challenger_id)
          .neq("ai_validated", "rejected")
          .gte("occurred_on", weekStart)
          .lt("occurred_on", endIso),
        supabaseAdmin
          .from("checkins")
          .select("points_awarded")
          .eq("challenge_id", d.challenge_id)
          .eq("user_id", d.opponent_id)
          .neq("ai_validated", "rejected")
          .gte("occurred_on", weekStart)
          .lt("occurred_on", endIso),
      ]);
      const chPts = (chRes.data ?? []).reduce((s: number, r: any) => s + Number(r.points_awarded ?? 0), 0);
      const opPts = (opRes.data ?? []).reduce((s: number, r: any) => s + Number(r.points_awarded ?? 0), 0);

      let winner: string | null = null;
      let tied = false;
      if (chPts > opPts) winner = d.challenger_id;
      else if (opPts > chPts) winner = d.opponent_id;
      else tied = true;

      await supabaseAdmin
        .from("duels")
        .update({
          status: "resolved",
          winner_id: winner,
          tied,
          challenger_points: Math.round(chPts),
          opponent_points: Math.round(opPts),
          resolved_at: new Date().toISOString(),
        })
        .eq("id", d.id);

      if (winner) {
        try {
          await supabaseAdmin.rpc("award_badge", {
            _user_id: winner,
            _slug: "duel_winner",
            _challenge_id: d.challenge_id,
          });
        } catch {
          /* non-fatal */
        }
      }

      // Notificar ambos os lados
      try {
        const loser = winner ? (winner === d.challenger_id ? d.opponent_id : d.challenger_id) : null;
        const notifications: any[] = [];
        if (tied) {
          for (const uid of [d.challenger_id, d.opponent_id]) {
            notifications.push({
              user_id: uid,
              kind: "duel_resolved",
              title: `🤝 Duelo empatou — ${chPts} x ${opPts}`,
              body: "Ninguém levou. Bora marcar revanche.",
              link: `/c/${d.challenge_id}/duels`,
              source_type: "duel",
              source_id: d.id,
            });
          }
        } else if (winner && loser) {
          notifications.push({
            user_id: winner,
            kind: "duel_won",
            title: `🏆 Vitória! ${chPts > opPts ? chPts : opPts} x ${chPts > opPts ? opPts : chPts}`,
            body: `Você venceu o duelo e ganhou +${d.stake_points} pts.`,
            link: `/c/${d.challenge_id}/duels`,
            source_type: "duel",
            source_id: d.id,
          });
          notifications.push({
            user_id: loser,
            kind: "duel_lost",
            title: `💀 Você perdeu o duelo — ${chPts} x ${opPts}`,
            body: `Perdeu ${d.stake_points} pts. Revanche na próxima?`,
            link: `/c/${d.challenge_id}/duels`,
            source_type: "duel",
            source_id: d.id,
          });
        }
        if (notifications.length) {
          await supabaseAdmin.from("notifications").insert(notifications);
        }
      } catch {
        /* non-fatal */
      }

      resolved += 1;
    }

    return { resolved };
  });

/**
 * Return duel_winner badge counts per user for a given challenge.
 */
export const getDuelWinsForChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Get badge id for duel_winner
    const { data: badge } = await (supabase as any)
      .from("badges")
      .select("id")
      .eq("slug", "duel_winner")
      .maybeSingle();
    if (!badge) return { wins: {} as Record<string, number> };

    const { data: rows } = await (supabase as any)
      .from("user_badges")
      .select("user_id")
      .eq("badge_id", badge.id)
      .eq("challenge_id", data.challengeId);

    const wins: Record<string, number> = {};
    for (const r of rows ?? []) {
      wins[r.user_id] = (wins[r.user_id] ?? 0) + 1;
    }
    return { wins };
  });

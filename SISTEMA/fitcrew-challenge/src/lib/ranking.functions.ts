import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TiebreakCriterion = "days" | "duration" | "first_to_reach" | "weight_evolution" | "daily_pose";

export type RankingRow = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_bot: boolean;
  total_points: number;
  counted_days: number;
  total_minutes: number;
  first_reached_at: string | null;
  weight_evolution_pct: number | null;
  daily_pose_count: number;
  tiebreak_applied: TiebreakCriterion | null;
  prize_position: number | null;
  prize_amount: number | null;
  pending_review: number;
  rejected: number;
};

export type RankingPayload = {
  challenge: {
    id: string;
    name: string;
    entry_fee: number;
    currency: string;
    prize_split: { position: number; percent: number }[];
    tiebreakers: TiebreakCriterion[];
    starts_at: string;
    ends_at: string;
  };
  pot: {
    participants: number;
    total: number;
  };
  rows: RankingRow[];
};

export const getRankingWithTiebreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<RankingPayload> => {
    const { supabase } = context;

    const { data: challengeRaw, error: cErr } = await supabase
      .from("challenges")
      .select(
        "id, name, entry_fee, currency, prize_split, tiebreakers, starts_at, ends_at, tiebreak_duration_cap_min" as any,
      )
      .eq("id", data.challengeId)
      .maybeSingle();
    if (cErr || !challengeRaw) throw new Error("Temporada não encontrada.");
    const challenge = challengeRaw as any;
    const tiebreakDurationCap = Math.max(15, Number(challenge.tiebreak_duration_cap_min ?? 120));

    const tiebreakers = ((challenge as any).tiebreakers ?? [
      "days",
      "duration",
      "first_to_reach",
      "weight_evolution",
      "daily_pose",
    ]) as TiebreakCriterion[];

    // Agrega check-ins
    const { data: checkins, error: chErr } = await supabase
      .from("checkins")
      .select(
        "user_id, occurred_on, duration_min, points_awarded, over_limit, used_daily_pose, created_at, ai_validated",
      )
      .eq("challenge_id", challenge.id);
    if (chErr) throw new Error(chErr.message);

    // Peso: pega peso mais antigo e mais recente do usuário dentro da janela
    const { data: weights } = await supabase
      .from("body_metrics_history")
      .select("user_id, weight_kg, recorded_at")
      .gte("recorded_at", `${challenge.starts_at}T00:00:00Z`)
      .lte("recorded_at", `${challenge.ends_at}T23:59:59Z`)
      .order("recorded_at", { ascending: true });

    const wByUser = new Map<string, { first: number; last: number }>();
    (weights ?? []).forEach((w: any) => {
      const cur = wByUser.get(w.user_id);
      const kg = Number(w.weight_kg);
      if (!cur) wByUser.set(w.user_id, { first: kg, last: kg });
      else wByUser.set(w.user_id, { first: cur.first, last: kg });
    });

    // Profiles (inclui todo mundo — pra listar quem não deu check-in também)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, is_bot");

    type Agg = {
      total: number;
      days: Set<string>;
      duration: number;
      firstReachedAt: string | null;
      pending: number;
      rejected: number;
      dailyPoseCount: number;
    };
    const byUser = new Map<string, Agg>();
    const ensure = (uid: string) => {
      let a = byUser.get(uid);
      if (!a) {
        a = { total: 0, days: new Set(), duration: 0, firstReachedAt: null, pending: 0, rejected: 0, dailyPoseCount: 0 };
        byUser.set(uid, a);
      }
      return a;
    };

    (checkins ?? [])
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .forEach((c: any) => {
        const a = ensure(c.user_id);
        if (c.ai_validated === "rejected") {
          a.rejected += 1;
          return;
        }
        if (c.ai_validated === "needs_review") a.pending += 1;
        a.total += c.points_awarded ?? 0;
        // TRAVA 3: cap de 120min por check-in no critério de desempate "duração".
        // Evita inflar minutos declarando sessões absurdas (ex: 600min de yoga).
        a.duration += Math.min(c.duration_min ?? 0, tiebreakDurationCap);
        if (!c.over_limit) a.days.add(c.occurred_on);
        if (a.total > 0 && !a.firstReachedAt) a.firstReachedAt = c.created_at;
        if (c.used_daily_pose) a.dailyPoseCount += 1;
      });

    // Só membros deste desafio entram no ranking (evita listar perfis de outros
    // desafios / usuários avulsos e induzir ações como "Cutucar" contra quem
    // não é membro).
    const { data: membersBonus } = await supabase
      .from("challenge_members")
      .select("user_id, bonus_points")
      .eq("challenge_id", challenge.id);
    const memberIds = new Set((membersBonus ?? []).map((m: any) => m.user_id));

    (profiles ?? []).forEach((p: any) => {
      if (memberIds.has(p.id) && !byUser.has(p.id)) ensure(p.id);
    });

    // Remove qualquer user_id que veio de check-ins órfãos mas não é mais membro
    for (const uid of Array.from(byUser.keys())) {
      if (!memberIds.has(uid)) byUser.delete(uid);
    }

    // Soma bonus_points da roleta (por membro)
    (membersBonus ?? []).forEach((m: any) => {
      const bp = m.bonus_points ?? 0;
      if (!bp) return;
      const a = ensure(m.user_id);
      a.total += bp;
    });


    const rowsPre: RankingRow[] = Array.from(byUser.entries()).map(([uid, a]) => {
      const p = (profiles ?? []).find((x: any) => x.id === uid);
      const w = wByUser.get(uid);
      const evolPct =
        w && w.first > 0 ? +(((w.first - w.last) / w.first) * 100).toFixed(2) : null;
      return {
        user_id: uid,
        display_name: p?.display_name ?? "Sem nome",
        username: p?.username ?? null,
        avatar_url: p?.avatar_url ?? null,
        is_bot: !!p?.is_bot,
        total_points: a.total,
        counted_days: a.days.size,
        total_minutes: a.duration,
        first_reached_at: a.firstReachedAt,
        weight_evolution_pct: evolPct,
        daily_pose_count: a.dailyPoseCount,
        tiebreak_applied: null,
        prize_position: null,
        prize_amount: null,
        pending_review: a.pending,
        rejected: a.rejected,
      };
    });

    // Não coloca o bot no ranking
    const rows = rowsPre.filter((r) => !r.is_bot);

    // Ordenação com desempate em cascata
    const cmp = (a: RankingRow, b: RankingRow): { r: number; applied: TiebreakCriterion | null } => {
      if (a.total_points !== b.total_points) {
        return { r: b.total_points - a.total_points, applied: null };
      }
      for (const t of tiebreakers) {
        if (t === "days" && a.counted_days !== b.counted_days) {
          return { r: b.counted_days - a.counted_days, applied: "days" };
        }
        if (t === "duration" && a.total_minutes !== b.total_minutes) {
          return { r: b.total_minutes - a.total_minutes, applied: "duration" };
        }
        if (t === "first_to_reach" && a.first_reached_at !== b.first_reached_at) {
          if (!a.first_reached_at) return { r: 1, applied: "first_to_reach" };
          if (!b.first_reached_at) return { r: -1, applied: "first_to_reach" };
          return {
            r: a.first_reached_at.localeCompare(b.first_reached_at),
            applied: "first_to_reach",
          };
        }
        if (t === "weight_evolution") {
          const av = a.weight_evolution_pct ?? -999;
          const bv = b.weight_evolution_pct ?? -999;
          if (av !== bv) return { r: bv - av, applied: "weight_evolution" };
        }
        if (t === "daily_pose" && a.daily_pose_count !== b.daily_pose_count) {
          return { r: b.daily_pose_count - a.daily_pose_count, applied: "daily_pose" };
        }
      }
      return { r: 0, applied: null };
    };

    rows.sort((a, b) => cmp(a, b).r);

    // Marca critério aplicado (comparando cada linha com a de cima)
    for (let i = 1; i < rows.length; i++) {
      const { applied } = cmp(rows[i - 1], rows[i]);
      if (applied && rows[i - 1].total_points === rows[i].total_points) {
        rows[i].tiebreak_applied = applied;
      }
    }

    // Pot & prize split
    const { count: participantCount } = await supabase
      .from("challenge_participants")
      .select("*", { count: "exact", head: true })
      .eq("challenge_id", challenge.id)
      .eq("paid", true);

    // Fallback: se ninguém foi marcado como pago ainda, conta usuários com >=1 check-in
    const activeUsers = rows.filter((r) => r.total_points > 0).length;
    const participants = participantCount && participantCount > 0 ? participantCount : activeUsers;
    const fee = Number((challenge as any).entry_fee ?? 0);
    const total = +(participants * fee).toFixed(2);

    const split = ((challenge as any).prize_split ?? []) as { position: number; percent: number }[];
    split
      .slice()
      .sort((a, b) => a.position - b.position)
      .forEach((s) => {
        const row = rows[s.position - 1];
        if (row) {
          row.prize_position = s.position;
          row.prize_amount = +((total * s.percent) / 100).toFixed(2);
        }
      });

    return {
      challenge: {
        id: challenge.id,
        name: challenge.name,
        entry_fee: fee,
        currency: (challenge as any).currency ?? "BRL",
        prize_split: split,
        tiebreakers,
        starts_at: challenge.starts_at,
        ends_at: challenge.ends_at,
      },
      pot: { participants, total },
      rows,
    };
  });

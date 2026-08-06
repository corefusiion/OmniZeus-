import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Listar histórico de métricas corporais do usuário autenticado. */
export const listBodyMetricsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("body_metrics_history")
      .select("id, recorded_at, weight_kg, height_cm, bmi, bmr, note")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { history: data ?? [] };
  });

/** Fotos de check-in mais próximas de duas datas alvo, para comparação antes/depois. */
export const getBeforeAfterPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        beforeDate: z.string(),
        afterDate: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    async function nearest(target: string) {
      // buscar até 5 candidatos próximos (antes + depois) e escolher o de menor diff
      const [beforeQ, afterQ] = await Promise.all([
        supabase
          .from("checkins")
          .select("id, occurred_on, photo_url, duration_min, caption")
          .eq("user_id", userId)
          .eq("challenge_id", data.challengeId)
          .not("photo_url", "is", null)
          .lte("occurred_on", target)
          .order("occurred_on", { ascending: false })
          .limit(1),
        supabase
          .from("checkins")
          .select("id, occurred_on, photo_url, duration_min, caption")
          .eq("user_id", userId)
          .eq("challenge_id", data.challengeId)
          .not("photo_url", "is", null)
          .gt("occurred_on", target)
          .order("occurred_on", { ascending: true })
          .limit(1),
      ]);
      const cands = [...(beforeQ.data ?? []), ...(afterQ.data ?? [])];
      if (cands.length === 0) return null;
      const tMs = new Date(target + "T00:00:00").getTime();
      cands.sort(
        (a, b) =>
          Math.abs(new Date(a.occurred_on + "T00:00:00").getTime() - tMs) -
          Math.abs(new Date(b.occurred_on + "T00:00:00").getTime() - tMs),
      );
      return cands[0];
    }

    const [before, after] = await Promise.all([nearest(data.beforeDate), nearest(data.afterDate)]);
    const paths = [before?.photo_url, after?.photo_url].filter(Boolean) as string[];
    let signedMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("checkin-photos")
        .createSignedUrls(paths, 60 * 60);
      signedMap = new Map(
        (signed ?? [])
          .filter((s): s is typeof s & { signedUrl: string } => !!s.signedUrl && !!s.path)
          .map((s) => [s.path!, s.signedUrl]),
      );
    }

    // Métricas mais próximas de cada data
    async function nearestMetric(target: string) {
      const { data: rows } = await supabase
        .from("body_metrics_history")
        .select("recorded_at, weight_kg, bmi")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false });
      if (!rows || rows.length === 0) return null;
      const tMs = new Date(target + "T00:00:00").getTime();
      rows.sort(
        (a, b) =>
          Math.abs(new Date(a.recorded_at).getTime() - tMs) -
          Math.abs(new Date(b.recorded_at).getTime() - tMs),
      );
      return rows[0];
    }

    const [beforeMetric, afterMetric] = await Promise.all([
      nearestMetric(data.beforeDate),
      nearestMetric(data.afterDate),
    ]);

    return {
      before: before
        ? {
            id: before.id,
            occurred_on: before.occurred_on,
            duration_min: before.duration_min,
            caption: before.caption,
            photo_signed_url: signedMap.get(before.photo_url!) ?? null,
          }
        : null,
      after: after
        ? {
            id: after.id,
            occurred_on: after.occurred_on,
            duration_min: after.duration_min,
            caption: after.caption,
            photo_signed_url: signedMap.get(after.photo_url!) ?? null,
          }
        : null,
      beforeMetric,
      afterMetric,
    };
  });

/** Pausa o desafio para o usuário (max 7 dias, 1x a cada 30 dias). */
export const pauseChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        days: z.number().int().min(1).max(7),
        reason: z.string().max(200).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const untilDate = new Date(today);
    untilDate.setUTCDate(untilDate.getUTCDate() + data.days - 1);
    const until = untilDate.toISOString().slice(0, 10);

    const { error } = await supabase
      .from("challenge_members")
      .update({
        paused_from: from,
        paused_until: until,
        pause_reason: data.reason ?? null,
      })
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId);
    if (error) throw new Error(error.message);

    // recalcular streak considerando pausa
    await supabase.rpc("recalc_streak", { _user_id: userId, _challenge_id: data.challengeId } as never);
    return { ok: true, paused_from: from, paused_until: until };
  });

/** Retomar antes do fim da pausa. */
export const resumeChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Só zera as datas — mantém last_pause_at para o cooldown de 30d
    const { error } = await supabase
      .from("challenge_members")
      .update({ paused_from: null, paused_until: null, pause_reason: null })
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId);
    if (error) throw new Error(error.message);
    await supabase.rpc("recalc_streak", { _user_id: userId, _challenge_id: data.challengeId } as never);
    return { ok: true };
  });

/** Estado da pausa do membro atual. */
export const getMyMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ challengeId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("challenge_members")
      .select("paused_from, paused_until, pause_reason, last_pause_at, current_streak, longest_streak, last_checkin_date")
      .eq("user_id", userId)
      .eq("challenge_id", data.challengeId)
      .maybeSingle();
    return { membership: row };
  });

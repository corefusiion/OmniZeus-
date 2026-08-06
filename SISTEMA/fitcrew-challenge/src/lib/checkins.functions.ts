import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistMentions } from "@/lib/mentions.functions";
import { flagCommentIfNeeded } from "@/lib/moderation.functions";



const createCheckinSchema = z
  .object({
    challengeId: z.string().uuid(),
    exerciseTypeId: z.string().uuid(),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    durationMin: z.number().int().min(1).max(600),
    photoPath: z.string().min(1).nullable().optional(),
    caption: z.string().max(500).optional().nullable(),
    source: z.enum(["manual", "strava", "health"]).default("manual"),
    photoSource: z.enum(["camera", "gallery", "unknown"]).default("unknown"),
    photoTakenAt: z.string().datetime().nullable().optional(),
    startedAtLocal: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable()
      .optional(),
    locationLat: z.number().min(-90).max(90).nullable().optional(),
    locationLng: z.number().min(-180).max(180).nullable().optional(),
    locationAccuracyM: z.number().min(0).max(1_000_000).nullable().optional(),
    locationName: z.string().trim().max(200).nullable().optional(),
    locationAddress: z.string().trim().max(500).nullable().optional(),
    locationSource: z.enum(["nominatim", "manual", "mixed"]).nullable().optional(),
  })
  .refine((d) => d.source !== "manual" || !!d.photoPath, {
    message: "A foto do dia é obrigatória em check-ins manuais.",
    path: ["photoPath"],
  });

export const createCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createCheckinSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: challenge, error: chErr } = await supabase
      .from("challenges")
      .select(
        "id, max_days_per_week, is_active, starts_at, ends_at, streak_bonus_points, checkin_cooldown_min, duration_bonus_step_min, duration_bonus_cap_pct" as any,
      )
      .eq("id", data.challengeId)
      .maybeSingle();
    if (chErr || !challenge) throw new Error("Temporada não encontrada.");
    if (!(challenge as any).is_active) throw new Error("Essa temporada não está ativa.");
    if (data.occurredOn < (challenge as any).starts_at || data.occurredOn > (challenge as any).ends_at) {
      throw new Error("Data fora do intervalo da temporada.");
    }

    const ch = challenge as any;
    const cooldownMin = Math.max(0, Number(ch.checkin_cooldown_min ?? 30));
    const bonusStepMin = Math.max(5, Number(ch.duration_bonus_step_min ?? 15));
    const bonusCapPct = Math.max(0, Number(ch.duration_bonus_cap_pct ?? 50));

    const { data: exercise, error: exErr } = await supabase
      .from("exercise_types")
      .select("id, points, min_minutes, challenge_id")
      .eq("id", data.exerciseTypeId)
      .maybeSingle();
    if (exErr || !exercise) throw new Error("Tipo de exercício inválido.");
    if (exercise.challenge_id !== ch.id) {
      throw new Error("Exercício não pertence a esta temporada.");
    }
    if (data.durationMin < exercise.min_minutes) {
      throw new Error(`Duração mínima para este exercício é ${exercise.min_minutes} minutos.`);
    }

    // ═══════════════ TRAVA 2: Cooldown entre check-ins ═══════════════
    if (data.source === "manual" && cooldownMin > 0) {
      const cooldownMs = cooldownMin * 60 * 1000;
      const since = new Date(Date.now() - cooldownMs).toISOString();
      const { data: recent } = await supabase
        .from("checkins")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (recent && recent.length > 0) {
        const last = new Date((recent[0] as any).created_at).getTime();
        const waitMin = Math.ceil((cooldownMs - (Date.now() - last)) / 60000);
        throw new Error(
          `Aguarde ${waitMin} min antes do próximo check-in (cooldown de ${cooldownMin} min entre registros).`,
        );
      }
    }

    // Semana ISO
    const occurred = new Date(data.occurredOn + "T00:00:00Z");
    const day = occurred.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    const weekStart = new Date(occurred);
    weekStart.setUTCDate(occurred.getUTCDate() - diffToMonday);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const { data: weekCheckins, error: wErr } = await supabase
      .from("checkins")
      .select("occurred_on, over_limit")
      .eq("user_id", userId)
      .eq("challenge_id", ch.id)
      .gte("occurred_on", iso(weekStart))
      .lte("occurred_on", iso(weekEnd));
    if (wErr) throw new Error("Falha ao verificar semana.");

    const countedDays = new Set(
      (weekCheckins ?? [])
        .filter((c) => !c.over_limit && c.occurred_on !== data.occurredOn)
        .map((c) => c.occurred_on),
    );

    const alreadyCountedThisDay = (weekCheckins ?? []).some(
      (c) => c.occurred_on === data.occurredOn && !c.over_limit,
    );

    // ═══════════════ TRAVA 1: Pontos proporcionais com teto ═══════════════
    const basePoints = exercise.points;
    const extraMin = Math.max(0, data.durationMin - exercise.min_minutes);
    const durationBonusRaw = Math.floor(extraMin / bonusStepMin);
    const durationBonusCap = Math.floor((basePoints * bonusCapPct) / 100);
    const durationBonus = Math.min(durationBonusRaw, durationBonusCap);
    const durationBonusCapped = durationBonusRaw > durationBonusCap;

    // ═══════════════ TRAVA 4: Bônus de streak ═══════════════
    let streakBonus = 0;
    let streakActive = 0;
    if (ch.streak_bonus_points && ch.streak_bonus_points > 0) {
      const { data: memberRow } = await supabase
        .from("challenge_members")
        .select("current_streak")
        .eq("user_id", userId)
        .eq("challenge_id", ch.id)
        .maybeSingle();
      streakActive = (memberRow as any)?.current_streak ?? 0;
      if (streakActive >= 2) streakBonus = ch.streak_bonus_points;
    }

    let overLimit = false;
    let pointsAwarded = basePoints + durationBonus + streakBonus;
    let reason: string = "ok";

    if (alreadyCountedThisDay) {
      overLimit = true;
      pointsAwarded = 0;
      reason = "duplicate_day";
    } else if (countedDays.size >= ch.max_days_per_week) {
      overLimit = true;
      pointsAwarded = 0;
      reason = "over_weekly_limit";
    }

    // Photo anti-fraud (motivos estruturados p/ auditoria)
    let photoFlagged = false;
    const flagCodes: string[] = [];
    const flagReasons: string[] = [];
    const photoTakenAt = data.photoTakenAt ?? null;
    if (data.source === "manual" && data.photoPath) {
      if (data.photoSource === "gallery") {
        photoFlagged = true;
        flagCodes.push("gallery");
        flagReasons.push("Foto escolhida da galeria (não capturada agora)");
      }
      if (photoTakenAt) {
        const takenMs = new Date(photoTakenAt).getTime();
        const nowMs = Date.now();
        const diffHours = (nowMs - takenMs) / 36e5;
        if (diffHours > 24) {
          photoFlagged = true;
          flagCodes.push("photo_old_24h");
          flagReasons.push(`Foto tirada há ${Math.round(diffHours)}h`);
        }
      }
      // Removido: flag "no_exif". Fotos de galeria quase sempre não têm EXIF
      // legível pelo navegador (iOS/Android costumam stripar), então essa
      // marcação era ruidosa. A IA de visão já cuida de validar a foto.
    }

    const { data: inserted, error: insErr } = await supabase
      .from("checkins")
      .insert({
        user_id: userId,
        challenge_id: ch.id,
        exercise_type_id: exercise.id,
        occurred_on: data.occurredOn,
        duration_min: data.durationMin,
        photo_url: data.photoPath ?? null,
        caption: data.caption ?? null,
        source: data.source,
        points_awarded: pointsAwarded,
        points_base: overLimit ? 0 : basePoints,
        points_duration_bonus: overLimit ? 0 : durationBonus,
        points_streak_bonus: overLimit ? 0 : streakBonus,
        points_reason: reason,
        over_limit: overLimit,
        photo_source: data.photoSource,
        photo_taken_at: photoTakenAt,
        photo_flagged: photoFlagged,
        photo_flag_reason: photoFlagged ? flagReasons.join(" · ") : null,
        photo_flag_codes: flagCodes,
        ai_validated: photoFlagged ? "needs_review" : "approved",
        started_at_local: data.startedAtLocal ?? null,
        location_lat: data.locationLat ?? null,
        location_lng: data.locationLng ?? null,
        location_accuracy_m: data.locationAccuracyM ?? null,
        location_name: data.locationName ?? null,
        location_address: data.locationAddress ?? null,
        location_source: data.locationSource ?? null,
      } as any)
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Falha ao registrar check-in.");

    // Auditoria — registro automático quando o sistema sinaliza o check-in
    if (photoFlagged) {
      await (supabase as any).from("checkin_moderation_audit").insert({
        checkin_id: inserted.id,
        challenge_id: ch.id,
        actor_id: null, // sistema
        action: "auto_flagged",
        reasons: flagCodes,
        reasons_text: flagReasons.join(" · "),
        notes: null,
      });
    }


    if (data.caption) {
      const { data: me } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      await persistMentions({
        supabase,
        authorId: userId,
        sourceType: "checkin",
        sourceId: inserted.id,
        body: data.caption,
        link: `/feed#checkin-${inserted.id}`,
        actorName: (me as any)?.display_name ?? "Alguém",
      });
    }

    return {
      id: inserted.id,
      pointsAwarded,
      overLimit,
      countedDaysBefore: countedDays.size,
      maxDaysPerWeek: ch.max_days_per_week,
      photoFlagged,
      photoFlagReason: photoFlagged ? flagReasons.join(" · ") : null,
      breakdown: {
        base: overLimit ? 0 : basePoints,
        durationBonus: overLimit ? 0 : durationBonus,
        durationBonusCapped,
        durationBonusCap,
        streakBonus: overLimit ? 0 : streakBonus,
        streakActive,
        reason,
        bonusStepMin,
        bonusCapPct,
        cooldownMin,
      },
    };
  });

const reactionSchema = z.object({
  checkinId: z.string().uuid(),
  emoji: z.string().trim().min(1).max(12),
});

export const toggleReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => reactionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("checkin_reactions")
      .select("id")
      .eq("checkin_id", data.checkinId)
      .eq("user_id", userId)
      .eq("emoji", data.emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from("checkin_reactions").delete().eq("id", existing.id);
      return { reacted: false };
    }
    await supabase
      .from("checkin_reactions")
      .insert({ checkin_id: data.checkinId, user_id: userId, emoji: data.emoji });
    return { reacted: true };
  });

const commentSchema = z.object({
  checkinId: z.string().uuid(),
  body: z.string().trim().min(1).max(500),
});

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => commentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("checkin_comments")
      .insert({ checkin_id: data.checkinId, user_id: userId, body: data.body })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Falha ao comentar.");
    const { data: me } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    await persistMentions({
      supabase,
      authorId: userId,
      sourceType: "checkin_comment",
      sourceId: inserted.id,
      body: data.body,
      link: `/feed#checkin-${data.checkinId}`,
      actorName: (me as any)?.display_name ?? "Alguém",
    });
    const flagged = await flagCommentIfNeeded({
      supabase,
      userId,
      commentTable: "checkin_comments",
      commentId: inserted.id,
      body: data.body,
    });
    return { ok: true, flagged };
  });


export const deleteCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("checkins").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editCheckinCaption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ id: z.string().uuid(), caption: z.string().trim().max(500).nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("checkins")
      .update({ caption: data.caption })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editCheckinComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(500) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("checkin_comments")
      .update({ body: data.body })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCheckinComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("checkin_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ═══════════════════════════════════════════════════════════════════
// Batch check-in: 1 foto → N desafios
// ═══════════════════════════════════════════════════════════════════

const batchEntrySchema = z.object({
  challengeId: z.string().uuid(),
  exerciseTypeId: z.string().uuid(),
  usedDailyPose: z.boolean().optional().default(false),
  // Se este usuário é o "madrugador" (primeiro do dia), a pose que ele escolheu.
  chosenPoseKey: z.string().min(1).max(40).nullable().optional(),
});

const createCheckinBatchSchema = z
  .object({
    entries: z.array(batchEntrySchema).min(1).max(20),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    durationMin: z.number().int().min(1).max(600),
    photoPath: z.string().min(1).nullable().optional(),
    caption: z.string().max(500).optional().nullable(),
    source: z.enum(["manual", "strava", "health"]).default("manual"),
    photoSource: z.enum(["camera", "gallery", "unknown"]).default("unknown"),
    photoTakenAt: z.string().datetime().nullable().optional(),
    startedAtLocal: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable()
      .optional(),
    locationLat: z.number().min(-90).max(90).nullable().optional(),
    locationLng: z.number().min(-180).max(180).nullable().optional(),
    locationAccuracyM: z.number().min(0).max(1_000_000).nullable().optional(),
    locationName: z.string().trim().max(200).nullable().optional(),
    locationAddress: z.string().trim().max(500).nullable().optional(),
    locationSource: z.enum(["nominatim", "manual", "mixed"]).nullable().optional(),
  })
  .refine((d) => d.source !== "manual" || !!d.photoPath, {
    message: "A foto do dia é obrigatória em check-ins manuais.",
    path: ["photoPath"],
  });

type BatchResult = {
  challengeId: string;
  challengeName?: string | null;
  ok: boolean;
  id?: string;
  pointsAwarded?: number;
  overLimit?: boolean;
  photoFlagged?: boolean;
  photoFlagReason?: string | null;
  error?: string;
};

export const createCheckinBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createCheckinBatchSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Cooldown global aplicado uma única vez para o batch inteiro.
    if (data.source === "manual") {
      const { data: cfgs } = await supabase
        .from("challenges")
        .select("checkin_cooldown_min")
        .in(
          "id",
          data.entries.map((e) => e.challengeId),
        );
      const cooldownMin = Math.max(
        0,
        ...((cfgs ?? []) as any[]).map((c) => Number(c.checkin_cooldown_min ?? 30)),
        0,
      );
      if (cooldownMin > 0) {
        const cooldownMs = cooldownMin * 60 * 1000;
        const since = new Date(Date.now() - cooldownMs).toISOString();
        const { data: recent } = await supabase
          .from("checkins")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1);
        if (recent && recent.length > 0) {
          const last = new Date((recent[0] as any).created_at).getTime();
          const waitMin = Math.ceil((cooldownMs - (Date.now() - last)) / 60000);
          throw new Error(
            `Aguarde ${waitMin} min antes do próximo check-in (cooldown de ${cooldownMin} min entre registros).`,
          );
        }
      }
    }

    const results: BatchResult[] = [];
    const batchId = crypto.randomUUID();

    for (const entry of data.entries) {
      try {
        const { data: challenge } = await supabase
          .from("challenges")
          .select(
            "id, name, max_days_per_week, is_active, starts_at, ends_at, streak_bonus_points, duration_bonus_step_min, duration_bonus_cap_pct" as any,
          )
          .eq("id", entry.challengeId)
          .maybeSingle();
        if (!challenge) throw new Error("Temporada não encontrada.");
        const ch = challenge as any;
        if (!ch.is_active) throw new Error("Essa temporada não está ativa.");
        if (data.occurredOn < ch.starts_at || data.occurredOn > ch.ends_at) {
          throw new Error("Data fora do intervalo da temporada.");
        }

        const bonusStepMin = Math.max(5, Number(ch.duration_bonus_step_min ?? 15));
        const bonusCapPct = Math.max(0, Number(ch.duration_bonus_cap_pct ?? 50));

        const { data: exercise } = await supabase
          .from("exercise_types")
          .select("id, points, min_minutes, challenge_id")
          .eq("id", entry.exerciseTypeId)
          .maybeSingle();
        if (!exercise) throw new Error("Tipo de exercício inválido.");
        if (exercise.challenge_id !== ch.id) {
          throw new Error("Exercício não pertence a esta temporada.");
        }
        if (data.durationMin < exercise.min_minutes) {
          throw new Error(`Duração mínima é ${exercise.min_minutes}min.`);
        }

        const occurred = new Date(data.occurredOn + "T00:00:00Z");
        const day = occurred.getUTCDay();
        const diffToMonday = (day + 6) % 7;
        const weekStart = new Date(occurred);
        weekStart.setUTCDate(occurred.getUTCDate() - diffToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
        const iso = (d: Date) => d.toISOString().slice(0, 10);

        const { data: weekCheckins } = await supabase
          .from("checkins")
          .select("occurred_on, over_limit")
          .eq("user_id", userId)
          .eq("challenge_id", ch.id)
          .gte("occurred_on", iso(weekStart))
          .lte("occurred_on", iso(weekEnd));

        const countedDays = new Set(
          (weekCheckins ?? [])
            .filter((c) => !c.over_limit && c.occurred_on !== data.occurredOn)
            .map((c) => c.occurred_on),
        );
        const alreadyCountedThisDay = (weekCheckins ?? []).some(
          (c) => c.occurred_on === data.occurredOn && !c.over_limit,
        );

        const basePoints = exercise.points;
        const extraMin = Math.max(0, data.durationMin - exercise.min_minutes);
        const durationBonusRaw = Math.floor(extraMin / bonusStepMin);
        const durationBonusCap = Math.floor((basePoints * bonusCapPct) / 100);
        const durationBonus = Math.min(durationBonusRaw, durationBonusCap);

        let streakBonus = 0;
        if (ch.streak_bonus_points && ch.streak_bonus_points > 0) {
          const { data: memberRow } = await supabase
            .from("challenge_members")
            .select("current_streak")
            .eq("user_id", userId)
            .eq("challenge_id", ch.id)
            .maybeSingle();
          const streakActive = (memberRow as any)?.current_streak ?? 0;
          if (streakActive >= 2) streakBonus = ch.streak_bonus_points;
        }

        let overLimit = false;
        let pointsAwarded = basePoints + durationBonus + streakBonus;
        let reason: string = "ok";
        if (alreadyCountedThisDay) {
          overLimit = true;
          pointsAwarded = 0;
          reason = "duplicate_day";
        } else if (countedDays.size >= ch.max_days_per_week) {
          overLimit = true;
          pointsAwarded = 0;
          reason = "over_weekly_limit";
        }

        let photoFlagged = false;
        const flagCodes: string[] = [];
        const flagReasons: string[] = [];
        const photoTakenAt = data.photoTakenAt ?? null;
        if (data.source === "manual" && data.photoPath) {
          if (data.photoSource === "gallery") {
            photoFlagged = true;
            flagCodes.push("gallery");
            flagReasons.push("Foto escolhida da galeria (não capturada agora)");
          }
          if (photoTakenAt) {
            const diffHours = (Date.now() - new Date(photoTakenAt).getTime()) / 36e5;
            if (diffHours > 24) {
              photoFlagged = true;
              flagCodes.push("photo_old_24h");
              flagReasons.push(`Foto tirada há ${Math.round(diffHours)}h`);
            }
          }
        }

        const { data: inserted, error: insErr } = await supabase
          .from("checkins")
          .insert({
            user_id: userId,
            challenge_id: ch.id,
            exercise_type_id: exercise.id,
            occurred_on: data.occurredOn,
            duration_min: data.durationMin,
            photo_url: data.photoPath ?? null,
            caption: data.caption ?? null,
            source: data.source,
            points_awarded: pointsAwarded,
            points_base: overLimit ? 0 : basePoints,
            points_duration_bonus: overLimit ? 0 : durationBonus,
            points_streak_bonus: overLimit ? 0 : streakBonus,
            points_reason: reason,
            over_limit: overLimit,
            photo_source: data.photoSource,
            photo_taken_at: photoTakenAt,
            photo_flagged: photoFlagged,
            photo_flag_reason: photoFlagged ? flagReasons.join(" · ") : null,
            photo_flag_codes: flagCodes,
            ai_validated: photoFlagged ? "needs_review" : "approved",
            started_at_local: data.startedAtLocal ?? null,
            location_lat: data.locationLat ?? null,
            location_lng: data.locationLng ?? null,
            location_accuracy_m: data.locationAccuracyM ?? null,
            location_name: data.locationName ?? null,
            location_address: data.locationAddress ?? null,
            location_source: data.locationSource ?? null,
            batch_id: batchId,
            used_daily_pose: !!entry.usedDailyPose || !!entry.chosenPoseKey,
          } as any)
          .select("id")
          .single();
        if (insErr || !inserted) throw new Error(insErr?.message ?? "Falha ao registrar.");

        // Se este usuário é o "madrugador", grava a pose do dia (idempotente).
        if (entry.chosenPoseKey) {
          const { DAILY_POSES } = await import("./daily-poses");
          const pose = DAILY_POSES.find((p) => p.key === entry.chosenPoseKey);
          if (pose) {
            await (supabase as any).from("daily_poses").insert({
              challenge_id: ch.id,
              date: data.occurredOn,
              pose_key: pose.key,
              pose_emoji: pose.emoji,
              pose_name: pose.name,
              chosen_by_user_id: userId,
            });
          }
        }

        if (photoFlagged) {
          await (supabase as any).from("checkin_moderation_audit").insert({
            checkin_id: inserted.id,
            challenge_id: ch.id,
            actor_id: null,
            action: "auto_flagged",
            reasons: flagCodes,
            reasons_text: flagReasons.join(" · "),
            notes: null,
          });
        }

        results.push({
          challengeId: ch.id,
          challengeName: ch.name,
          ok: true,
          id: inserted.id,
          pointsAwarded,
          overLimit,
          photoFlagged,
          photoFlagReason: photoFlagged ? flagReasons.join(" · ") : null,
        });
      } catch (e: any) {
        results.push({
          challengeId: entry.challengeId,
          ok: false,
          error: e?.message ?? "Falha ao registrar check-in.",
        });
      }
    }

    // Menções da legenda: uma única vez, apontando pro primeiro check-in criado.
    const firstOk = results.find((r) => r.ok && r.id);
    if (firstOk && data.caption) {
      const { data: me } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      await persistMentions({
        supabase,
        authorId: userId,
        sourceType: "checkin",
        sourceId: firstOk.id!,
        body: data.caption,
        link: `/feed#checkin-${firstOk.id}`,
        actorName: (me as any)?.display_name ?? "Alguém",
      });
    }

    return { results };
  });

// Propaga decisão da IA sobre a foto para todos os check-ins do mesmo batch
// (mesmo photo_url do mesmo usuário, criados nos últimos 2 minutos).
export const propagatePhotoDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        checkinId: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "needs_review"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: source } = await supabase
      .from("checkins")
      .select("photo_url, created_at")
      .eq("id", data.checkinId)
      .maybeSingle();
    if (!source?.photo_url) return { updated: 0 };
    const since = new Date(new Date(source.created_at).getTime() - 2 * 60 * 1000).toISOString();
    const patch: any = { ai_validated: data.decision };
    if (data.decision === "rejected") {
      patch.points_awarded = 0;
      patch.over_limit = true;
    }
    const { data: updated } = await supabase
      .from("checkins")
      .update(patch)
      .eq("user_id", userId)
      .eq("photo_url", source.photo_url)
      .gte("created_at", since)
      .neq("id", data.checkinId)
      .select("id");
    return { updated: (updated ?? []).length };
  });

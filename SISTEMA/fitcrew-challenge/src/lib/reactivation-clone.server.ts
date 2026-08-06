import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Args = {
  originalChallengeId: string;
  triggeredByUserId: string;
  stripeSessionId: string;
};

/**
 * Clona um desafio finalizado como uma "Nova Temporada":
 * - Copia regras, nome (com sufixo), descrição, capa, configurações
 * - Datas: começa hoje, dura a mesma quantidade de dias do original
 * - Migra todos os membros com pontuação zerada
 * - Copia exercise_types
 * - Marca o desafio original como já reativado
 * Idempotente via campo reactivated_to_id do original.
 */
export async function cloneChallengeForNewSeason({
  originalChallengeId,
  triggeredByUserId,
  stripeSessionId,
}: Args): Promise<string | null> {
  const { data: orig, error } = await supabaseAdmin
    .from("challenges")
    .select("*")
    .eq("id", originalChallengeId)
    .maybeSingle();
  if (error || !orig) {
    console.error("[reactivation-clone] desafio original não encontrado", originalChallengeId, error);
    return null;
  }
  if (orig.reactivated_to_id) {
    console.info("[reactivation-clone] já reativado, ignorando", { originalChallengeId, existing: orig.reactivated_to_id });
    return orig.reactivated_to_id as string;
  }

  // Duração em dias baseada no original
  const startsAtOrig = new Date(orig.starts_at as string);
  const endsAtOrig = new Date(orig.ends_at as string);
  const durationDays = Math.max(
    1,
    Math.round((endsAtOrig.getTime() - startsAtOrig.getTime()) / (1000 * 60 * 60 * 24)) || 30,
  );

  const today = new Date();
  const startISO = today.toISOString().slice(0, 10);
  const end = new Date(today);
  end.setDate(end.getDate() + durationDays);
  const endISO = end.toISOString().slice(0, 10);

  const newName = `${orig.name} — Nova Temporada`.slice(0, 200);

  // Gera novo invite_code único
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randCode = () => {
    let s = "FIT-";
    for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  };
  const inviteCode = randCode();

  const insertPayload: Record<string, unknown> = {
    name: newName,
    description: orig.description,
    starts_at: startISO,
    ends_at: endISO,
    is_active: true,
    status: "active",
    closed_at: null,
    max_days_per_week: orig.max_days_per_week,
    streak_bonus_points: orig.streak_bonus_points,
    entry_fee: orig.entry_fee,
    currency: orig.currency,
    prize_split: orig.prize_split,
    tiebreakers: orig.tiebreakers,
    owner_id: orig.owner_id,
    created_by: triggeredByUserId,
    invite_code: inviteCode,
    invite_enabled: orig.invite_enabled,
    is_public: orig.is_public,
    city: orig.city,
    weigh_in_day_of_week: orig.weigh_in_day_of_week,
    weigh_in_enabled: orig.weigh_in_enabled,
    checkin_cooldown_min: orig.checkin_cooldown_min,
    duration_bonus_step_min: orig.duration_bonus_step_min,
    duration_bonus_cap_pct: orig.duration_bonus_cap_pct,
    tiebreak_duration_cap_min: orig.tiebreak_duration_cap_min,
    banner_url: orig.banner_url,
    absence_penalty_pts: orig.absence_penalty_pts,
    member_limit: orig.member_limit,
    is_pro: orig.is_pro,
  };

  const { data: created, error: insErr } = await supabaseAdmin
    .from("challenges")
    .insert(insertPayload as never)
    .select("id")
    .single();
  if (insErr || !created) {
    console.error("[reactivation-clone] falha ao criar novo desafio", insErr);
    throw new Error(insErr?.message ?? "Falha ao clonar desafio.");
  }
  const newId = created.id as string;

  // Copia exercise_types
  const { data: exs } = await supabaseAdmin
    .from("exercise_types")
    .select("name, icon, points, min_minutes, sort_order")
    .eq("challenge_id", originalChallengeId);
  if (exs && exs.length) {
    await supabaseAdmin
      .from("exercise_types")
      .insert(exs.map((e) => ({ ...e, challenge_id: newId })) as never);
  }

  // Migra membros (pontuação/streaks zerados)
  const { data: members } = await supabaseAdmin
    .from("challenge_members")
    .select("user_id, role")
    .eq("challenge_id", originalChallengeId);
  if (members && members.length) {
    await supabaseAdmin.from("challenge_members").upsert(
      members.map((m) => ({
        challenge_id: newId,
        user_id: m.user_id,
        role: m.role,
      })) as never,
      { onConflict: "challenge_id,user_id" },
    );
  }

  // Marca o original como reativado
  await supabaseAdmin
    .from("challenges")
    .update({ reactivated_to_id: newId, reactivation_requested: false } as never)
    .eq("id", originalChallengeId);

  // Notifica o dono
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: orig.owner_id,
      kind: "challenge_reactivated",
      title: "🎉 Nova temporada criada!",
      body: `A nova temporada de "${orig.name}" começou hoje. Todos os membros foram migrados com pontuação zerada.`,
      link: `/c/${newId}`,
      source_type: "challenge",
      source_id: newId,
    } as never);
  } catch (err) {
    console.warn("[reactivation-clone] notify falhou", err);
  }

  console.info("[reactivation-clone] concluído", { originalChallengeId, newId, stripeSessionId });
  return newId;
}

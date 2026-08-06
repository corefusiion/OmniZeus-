import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Generate short invite code (8 chars, url-safe)
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// -------- Listar desafios do usuário --------

export const getMyChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Membros
    const { data: memberRows, error } = await (supabase as any)
      .from("challenge_members")
      .select("role, joined_at, challenge:challenges(id, name, description, is_active, starts_at, ends_at, owner_id, invite_code, invite_enabled, max_days_per_week, streak_bonus_points, checkin_cooldown_min, duration_bonus_step_min, duration_bonus_cap_pct, tiebreak_duration_cap_min, closed_at, status, reactivation_requested)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (memberRows ?? [])
      .filter((r: any) => r.challenge)
      .map((r: any) => ({
        role: r.role as "owner" | "co_admin" | "member",
        joined_at: r.joined_at as string,
        challenge: r.challenge,
      }));
  });

// -------- Detalhes públicos de um convite (não requer auth) --------

export const getChallengeByInvite = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ code: z.string().min(4).max(16) }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    // Uses SECURITY DEFINER RPC — the challenges table no longer exposes invite_code
    // to anon SELECTs. The RPC only returns safe display fields for an exact-match code.
    const { data: rows, error } = await (client as any).rpc("get_challenge_by_invite", {
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return null;
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description ?? null) as string | null,
      starts_at: row.starts_at as string,
      ends_at: row.ends_at as string,
      is_active: row.is_active as boolean,
    };
  });

// -------- Entrar no desafio via código --------

export const joinChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ code: z.string().min(4).max(16) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const normalized = data.code.trim().toUpperCase();
    const { data: challengeId, error } = await (supabase as any).rpc("join_challenge_by_invite", {
      _code: normalized,
    });
    if (error) throw new Error(error.message);
    return { challengeId: challengeId as string };
  });

// -------- Criar um novo desafio (qualquer usuário) --------

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(500).nullable().optional(),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxDaysPerWeek: z.number().int().min(1).max(7).default(5),
  streakBonusPoints: z.number().int().min(0).max(50).default(2),
  entryFee: z.number().min(0).max(1_000_000).default(50),
  isPublic: z.boolean().default(false),
  city: z.string().trim().max(80).nullable().optional(),
});

const DEFAULT_EXERCISES = [
  { name: "Corrida", icon: "🏃", points: 10, min_minutes: 30, sort_order: 1 },
  { name: "Musculação", icon: "🏋️", points: 10, min_minutes: 30, sort_order: 2 },
  { name: "Ciclismo", icon: "🚴", points: 10, min_minutes: 30, sort_order: 3 },
  { name: "Funcional", icon: "🤸", points: 10, min_minutes: 30, sort_order: 4 },
  { name: "Caminhada", icon: "🚶", points: 8, min_minutes: 45, sort_order: 5 },
  { name: "Natação", icon: "🏊", points: 12, min_minutes: 30, sort_order: 6 },
  { name: "Yoga / Alongamento", icon: "🧘", points: 6, min_minutes: 30, sort_order: 7 },
  { name: "Crossfit / HIIT", icon: "🔥", points: 12, min_minutes: 25, sort_order: 8 },
];

export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.startsAt > data.endsAt) throw new Error("A data de início precisa ser antes do fim.");
    const code = generateInviteCode();
    const { data: challenge, error } = await (supabase as any)
      .from("challenges")
      .insert({
        name: data.name,
        description: data.description ?? null,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        max_days_per_week: data.maxDaysPerWeek,
        streak_bonus_points: data.streakBonusPoints,
        entry_fee: data.entryFee,
        currency: "BRL",
        is_active: true,
        is_public: data.isPublic,
        city: data.city && data.city.length ? data.city : null,
        owner_id: userId,
        created_by: userId,
        invite_code: code,
        invite_enabled: true,
      })
      .select("id, invite_code")
      .single();
    if (error || !challenge) throw new Error(error?.message ?? "Falha ao criar desafio.");

    // Dono como member "owner"
    await (supabase as any)
      .from("challenge_members")
      .upsert({ challenge_id: challenge.id, user_id: userId, role: "owner" }, { onConflict: "challenge_id,user_id" });

    // Exercícios padrão
    await (supabase as any).from("exercise_types").insert(
      DEFAULT_EXERCISES.map((e) => ({ ...e, challenge_id: challenge.id })),
    );

    return { id: challenge.id as string, inviteCode: challenge.invite_code as string };
  });

// -------- Rotacionar código de convite --------

export const rotateInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await (supabase as any).rpc("is_challenge_admin", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (!ok) throw new Error("Acesso restrito ao admin do desafio.");
    const code = generateInviteCode();
    const { error } = await (supabase as any)
      .from("challenges")
      .update({ invite_code: code })
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { inviteCode: code };
  });

// -------- Ligar / desligar convite --------

export const setInviteEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ challengeId: z.string().uuid(), enabled: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await (supabase as any).rpc("is_challenge_admin", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (!ok) throw new Error("Acesso restrito ao admin do desafio.");
    const { error } = await (supabase as any)
      .from("challenges")
      .update({ invite_enabled: data.enabled })
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Gerenciar membros: promover, rebaixar, remover --------

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(["co_admin", "member"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Owner, admin global ou super_admin podem mexer em co-admin
    const { data: challenge } = await (supabase as any)
      .from("challenges")
      .select("owner_id")
      .eq("id", data.challengeId)
      .maybeSingle();
    const [{ data: isGlobalAdmin }, { data: isSuper }] = await Promise.all([
      (supabase as any).rpc("has_role", { _user_id: userId, _role: "admin" }),
      (supabase as any).rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (!challenge) throw new Error("Desafio não encontrado.");
    if (challenge.owner_id !== userId && !isGlobalAdmin && !isSuper) {
      throw new Error("Só o dono do desafio pode alterar co-admins.");
    }
    if (data.userId === challenge.owner_id) throw new Error("O dono não pode ser rebaixado.");
    const { error } = await (supabase as any)
      .from("challenge_members")
      .update({ role: data.role })
      .eq("challenge_id", data.challengeId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ challengeId: z.string().uuid(), userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: challenge } = await (supabase as any)
      .from("challenges")
      .select("owner_id")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!challenge) throw new Error("Desafio não encontrado.");
    if (data.userId === challenge.owner_id) throw new Error("O dono não pode ser removido.");
    const [{ data: ok }, { data: isSuper }] = await Promise.all([
      (supabase as any).rpc("is_challenge_admin", {
        _user_id: userId,
        _challenge_id: data.challengeId,
      }),
      (supabase as any).rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (!ok && !isSuper) throw new Error("Acesso restrito ao admin do desafio.");
    const { error } = await (supabase as any)
      .from("challenge_members")
      .delete()
      .eq("challenge_id", data.challengeId)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Super Admin: entrar em qualquer desafio (sem convite) --------

export const joinChallengeAsSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await (supabase as any).rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Apenas Super Admins podem entrar sem convite.");
    const { error } = await (supabase as any)
      .from("challenge_members")
      .upsert(
        { challenge_id: data.challengeId, user_id: userId, role: "member" },
        { onConflict: "challenge_id,user_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Listar membros do desafio (para o painel) --------

export const listChallengeMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("challenge_members")
      .select("user_id, role, joined_at")
      .eq("challenge_id", data.challengeId)
      .order("joined_at", { ascending: true });
    if (error) throw new Error(error.message);
    const members = (rows ?? []) as Array<{ user_id: string; role: "owner" | "co_admin" | "member"; joined_at: string }>;
    const ids = members.map((m) => m.user_id);
    let profilesById = new Map<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null }>();
    if (ids.length > 0) {
      const { data: profs, error: pErr } = await (supabase as any)
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);
      if (pErr) throw new Error(pErr.message);
      profilesById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }
    return members.map((m) => ({ ...m, profile: profilesById.get(m.user_id) ?? null })) as Array<{
      user_id: string;
      role: "owner" | "co_admin" | "member";
      joined_at: string;
      profile: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
    }>;
  });

// -------- Sair do desafio (auto-remoção) --------

export const leaveChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: challenge } = await (supabase as any)
      .from("challenges")
      .select("owner_id")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!challenge) throw new Error("Desafio não encontrado.");

    if (challenge.owner_id === userId) {
      // Super Admins auto-transfer ownership to the oldest co-admin before leaving.
      const { data: isSuper } = await (supabase as any).rpc("has_role", {
        _user_id: userId,
        _role: "super_admin",
      });
      if (!isSuper) {
        throw new Error(
          "Você é o dono deste desafio. Peça a um Super Admin para transferir a propriedade antes de sair.",
        );
      }
      const { data: coAdmins } = await (supabase as any)
        .from("challenge_members")
        .select("user_id, joined_at")
        .eq("challenge_id", data.challengeId)
        .eq("role", "co_admin")
        .order("joined_at", { ascending: true })
        .limit(1);
      const newOwnerId = coAdmins?.[0]?.user_id as string | undefined;
      if (!newOwnerId) {
        throw new Error(
          "Promova um membro a Co-Admin antes de sair, ou exclua o desafio como Super Admin.",
        );
      }
      const { error: upErr } = await (supabase as any)
        .from("challenge_members")
        .update({ role: "owner" })
        .eq("challenge_id", data.challengeId)
        .eq("user_id", newOwnerId);
      if (upErr) throw new Error(upErr.message);
      const { error: chErr } = await (supabase as any)
        .from("challenges")
        .update({ owner_id: newOwnerId })
        .eq("id", data.challengeId);
      if (chErr) throw new Error(chErr.message);
    }

    const { data: deleted, error } = await (supabase as any)
      .from("challenge_members")
      .delete()
      .eq("challenge_id", data.challengeId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) throw new Error(error.message);
    if (!deleted || deleted.length === 0) {
      throw new Error("Não foi possível sair do desafio. Tente novamente.");
    }
    return { ok: true };
  });


// -------- Super Admin: transferir dono do desafio --------

export const transferChallengeOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        challengeId: z.string().uuid(),
        newOwnerUsername: z.string().trim().min(1).max(40).optional(),
        newOwnerId: z.string().uuid().optional(),
      })
      .refine((v) => v.newOwnerUsername || v.newOwnerId, {
        message: "Informe o username ou id do novo dono.",
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await (supabase as any).rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Apenas Super Admins podem transferir a propriedade de um desafio.");

    let newOwnerId = data.newOwnerId ?? null;
    if (!newOwnerId && data.newOwnerUsername) {
      const uname = data.newOwnerUsername.replace(/^@/, "").toLowerCase();
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("username", uname)
        .maybeSingle();
      if (!prof?.id) throw new Error(`Usuário @${uname} não encontrado.`);
      newOwnerId = prof.id;
    }
    if (!newOwnerId) throw new Error("Novo dono inválido.");

    const { data: challenge } = await (supabase as any)
      .from("challenges")
      .select("owner_id")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!challenge) throw new Error("Desafio não encontrado.");
    if (challenge.owner_id === newOwnerId) throw new Error("Esse usuário já é o dono.");

    const oldOwnerId = challenge.owner_id as string;

    // Garante que o novo dono é membro
    const { error: upErr } = await (supabase as any)
      .from("challenge_members")
      .upsert(
        { challenge_id: data.challengeId, user_id: newOwnerId, role: "owner" },
        { onConflict: "challenge_id,user_id" },
      );
    if (upErr) throw new Error(upErr.message);

    // Rebaixa o antigo dono para member
    if (oldOwnerId) {
      await (supabase as any)
        .from("challenge_members")
        .update({ role: "member" })
        .eq("challenge_id", data.challengeId)
        .eq("user_id", oldOwnerId);
    }

    // Atualiza o owner_id do desafio
    const { error: chErr } = await (supabase as any)
      .from("challenges")
      .update({ owner_id: newOwnerId })
      .eq("id", data.challengeId);
    if (chErr) throw new Error(chErr.message);

    return { ok: true, newOwnerId };
  });


// -------- Registrar interesse na reativação (feature paga) --------

export const requestChallengeReactivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await (supabase as any).rpc("is_challenge_admin", {
      _user_id: userId,
      _challenge_id: data.challengeId,
    });
    if (!ok) throw new Error("Só o admin do desafio pode solicitar reativação.");
    const { error } = await (supabase as any)
      .from("challenges")
      .update({
        reactivation_requested: true,
        reactivation_requested_at: new Date().toISOString(),
        reactivation_requested_by: userId,
      })
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Super Admin: excluir desafio (cascata via FKs) --------

export const deleteChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ challengeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await (supabase as any).rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Apenas Super Admins podem excluir desafios.");
    const { error } = await (supabase as any)
      .from("challenges")
      .delete()
      .eq("id", data.challengeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Acesso restrito ao Super Admin.");
}

export const getPlatformOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    // Total de usuários (via profiles — proxy seguro, sem tocar em auth.users)
    const { count: totalUsers } = await context.supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    // Desafios agrupados por owner
    const { data: challenges } = await context.supabase
      .from("challenges")
      .select("id, name, owner_id, member_count, status, starts_at, ends_at");

    const ownerIds = Array.from(new Set((challenges ?? []).map((c: any) => c.owner_id).filter(Boolean)));

    const { data: owners } = ownerIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", ownerIds)
      : { data: [] as any[] };

    const ownersById = new Map((owners ?? []).map((o: any) => [o.id, o]));
    const admins = ownerIds.map((id) => {
      const p: any = ownersById.get(id) ?? { id };
      const owned = (challenges ?? [])
        .filter((c: any) => c.owner_id === id)
        .map((c: any) => ({ id: c.id, name: c.name, status: c.status, owner_id: c.owner_id }));
      return {

        id,
        display_name: p.display_name ?? null,
        username: p.username ?? null,
        avatar_url: p.avatar_url ?? null,
        challenges: owned,
      };
    });

    // Contas bloqueadas — usa tabela user_warnings como proxy (histórico de infrações)
    const { data: warnings } = await context.supabase
      .from("user_warnings")
      .select("user_id, created_at, terms, source_type")
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      totalUsers: totalUsers ?? 0,
      totalChallenges: challenges?.length ?? 0,
      admins,
      recentWarnings: warnings ?? [],
    };
  });

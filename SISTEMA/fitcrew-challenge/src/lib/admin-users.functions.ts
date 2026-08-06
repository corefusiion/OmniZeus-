import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuper(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (!data) throw new Error("Acesso restrito ao Super Admin.");
}

export const listPlatformUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        q: z.string().trim().max(80).optional().default(""),
        page: z.number().int().min(1).max(10000).optional().default(1),
        pageSize: z.number().int().min(1).max(200).optional().default(20),
        all: z.boolean().optional().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);
    const { q, page, pageSize, all } = data;

    // Build contacts query (super admin can see all rows via RLS)
    let contactsQuery = context.supabase
      .from("user_contacts")
      .select("user_id, email, phone", { count: "exact" });

    if (q) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      contactsQuery = contactsQuery.or(`email.ilike.${like},phone.ilike.${like}`);
    }

    if (!all) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      contactsQuery = contactsQuery.range(from, to);
    }

    contactsQuery = contactsQuery.order("created_at", { ascending: false } as any);

    const { data: contacts, count, error } = await contactsQuery;
    if (error) throw new Error(error.message);

    const ids = (contacts ?? []).map((c: any) => c.user_id);
    let profilesById = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, created_at")
        .in("id", ids);
      profilesById = new Map((profs ?? []).map((p: any) => [p.id, p]));
    }

    const items = (contacts ?? []).map((c: any) => {
      const p = profilesById.get(c.user_id) ?? {};
      return {
        user_id: c.user_id,
        email: c.email ?? null,
        phone: c.phone ?? null,
        display_name: p.display_name ?? null,
        username: p.username ?? null,
        avatar_url: p.avatar_url ?? null,
        created_at: p.created_at ?? null,
      };
    });

    // If a text search is used, also try matching profiles (display_name/username)
    if (q && items.length < pageSize) {
      const like = `%${q.replace(/[%_]/g, "")}%`;
      const { data: extraProfiles } = await context.supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, created_at")
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .limit(pageSize);
      const seen = new Set(items.map((i) => i.user_id));
      const extraIds = (extraProfiles ?? []).map((p: any) => p.id).filter((id: string) => !seen.has(id));
      if (extraIds.length) {
        const { data: extraContacts } = await context.supabase
          .from("user_contacts")
          .select("user_id, email, phone")
          .in("user_id", extraIds);
        const cMap = new Map((extraContacts ?? []).map((c: any) => [c.user_id, c]));
        for (const p of extraProfiles ?? []) {
          if (seen.has(p.id)) continue;
          const c: any = cMap.get(p.id) ?? {};
          items.push({
            user_id: p.id,
            email: c.email ?? null,
            phone: c.phone ?? null,
            display_name: p.display_name ?? null,
            username: p.username ?? null,
            avatar_url: p.avatar_url ?? null,
            created_at: p.created_at ?? null,
          });
        }
      }
    }

    return { items, total: count ?? items.length, page, pageSize };
  });

export const updatePlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        display_name: z.string().trim().min(1).max(80).optional(),
        email: z.string().trim().email().max(255).optional().or(z.literal("")),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertSuper(context.supabase, context.userId);

    if (data.display_name !== undefined) {
      const { error } = await context.supabase
        .from("profiles")
        .update({ display_name: data.display_name })
        .eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }

    if (data.email !== undefined || data.phone !== undefined) {
      const payload: any = { user_id: data.user_id };
      if (data.email !== undefined) payload.email = data.email || null;
      if (data.phone !== undefined) payload.phone = data.phone || null;
      const { error } = await context.supabase
        .from("user_contacts")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

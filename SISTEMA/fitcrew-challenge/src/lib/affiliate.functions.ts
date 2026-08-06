import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAffiliateSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("affiliate_balance")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);

    const [{ count: referredCount }, earningsRes, withdrawsRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by_admin_id", userId),
      (supabase as any)
        .from("affiliate_earnings_log")
        .select("id, gross_amount, commission_amount, source_type, created_at, referred_user_id")
        .eq("admin_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("withdraw_requests")
        .select("id, amount, pix_key, status, created_at, paid_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return {
      balance: Number((profile as any)?.affiliate_balance ?? 0),
      referredCount: referredCount ?? 0,
      earnings: (earningsRes.data ?? []) as Array<{
        id: string;
        gross_amount: number;
        commission_amount: number;
        source_type: string;
        created_at: string;
        referred_user_id: string;
      }>,
      withdraws: (withdrawsRes.data ?? []) as Array<{
        id: string;
        amount: number;
        pix_key: string;
        status: "pending" | "paid" | "rejected";
        created_at: string;
        paid_at: string | null;
      }>,
    };
  });

export const requestWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ pixKey: z.string().trim().min(4).max(140) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: id, error } = await (supabase as any).rpc("request_withdraw", {
      _pix_key: data.pixKey,
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

export const listPendingWithdraws = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isSuper, error: rErr } = await (supabase as any).rpc("is_super_admin", { _user_id: userId });
    if (rErr) throw new Error(rErr.message);
    if (!isSuper) throw new Error("Apenas super admins.");

    const { data, error } = await (supabase as any)
      .from("withdraw_requests")
      .select("id, user_id, amount, pix_key, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{
      id: string;
      user_id: string;
      amount: number;
      pix_key: string;
      status: string;
      created_at: string;
    }>;

    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    let profileMap = new Map<string, { display_name: string; username: string | null }>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", ids);
      (profs ?? []).forEach((p: any) =>
        profileMap.set(p.id, { display_name: p.display_name, username: p.username ?? null }),
      );
    }
    return rows.map((r) => ({ ...r, user: profileMap.get(r.user_id) ?? null }));
  });

export const markWithdrawPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any).rpc("mark_withdraw_paid", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

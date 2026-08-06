import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, getStripeMode, siteOrigin } from "./stripe.server";

type Args = {
  userId: string;
  email?: string | null;
  challengeId: string;
  returnOrigin?: string | null;
};

function safeReturnOrigin(origin?: string | null): string {
  if (!origin) return siteOrigin();
  try {
    const url = new URL(origin);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || isLocal) return url.origin;
  } catch {}
  return siteOrigin();
}

export type ReactivationInfo = {
  challengeId: string;
  challengeName: string;
  memberCount: number;
  priceCents: number;
  priceLabel: string;
  tier: "standard" | "pro";
  alreadyReactivated: boolean;
  isFinished: boolean;
};

async function loadInfo(userId: string, challengeId: string): Promise<ReactivationInfo> {
  const { data: ch, error } = await supabaseAdmin
    .from("challenges")
    .select("id, name, owner_id, status, closed_at, ends_at, is_active, reactivated_to_id, member_count")
    .eq("id", challengeId)
    .maybeSingle();
  if (error || !ch) throw new Error("Desafio não encontrado.");

  const { data: memberRow } = await supabaseAdmin
    .from("challenge_members")
    .select("role")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = memberRow?.role;
  const isAdmin = ch.owner_id === userId || role === "owner" || role === "co_admin";
  if (!isAdmin) throw new Error("Só o admin do desafio pode iniciar uma nova temporada.");

  const today = new Date().toISOString().slice(0, 10);
  const isFinished =
    !!ch.closed_at || ch.status === "closed" || ch.is_active === false || (ch.ends_at && ch.ends_at < today);

  // conta real (member_count pode estar desatualizado)
  const { count } = await supabaseAdmin
    .from("challenge_members")
    .select("user_id", { count: "exact", head: true })
    .eq("challenge_id", challengeId);
  const memberCount = count ?? ch.member_count ?? 0;

  const tier: "standard" | "pro" = memberCount > 20 ? "pro" : "standard";
  const priceCents = tier === "pro" ? 1990 : 990;
  const priceLabel = tier === "pro" ? "R$ 19,90" : "R$ 9,90";

  return {
    challengeId: ch.id,
    challengeName: ch.name,
    memberCount,
    priceCents,
    priceLabel,
    tier,
    alreadyReactivated: !!ch.reactivated_to_id,
    isFinished: !!isFinished,
  };
}

export async function getReactivationInfoFor(userId: string, challengeId: string) {
  return loadInfo(userId, challengeId);
}

export async function createReactivationCheckout({ userId, email, challengeId, returnOrigin }: Args) {
  const info = await loadInfo(userId, challengeId);
  if (!info.isFinished) throw new Error("Este desafio ainda está ativo.");
  if (info.alreadyReactivated) throw new Error("Este desafio já foi reativado em uma nova temporada.");

  const stripe = getStripe();
  const stripeMode = getStripeMode();
  const origin = safeReturnOrigin(returnOrigin);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id, display_name")
    .eq("id", userId)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;
  if (customerId) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      if ((c as { deleted?: boolean }).deleted) customerId = null;
    } catch (err) {
      const e = err as { statusCode?: number; code?: string; message?: string };
      const missing =
        e.statusCode === 404 ||
        e.code === "resource_missing" ||
        e.message?.includes("No such customer") ||
        e.message?.includes("similar object exists in test mode") ||
        e.message?.includes("live mode key was used");
      if (!missing) throw err;
      customerId = null;
    }
  }
  if (!customerId) {
    const c = await stripe.customers.create({
      email: email ?? undefined,
      name: profile?.display_name ?? undefined,
      metadata: { user_id: userId, stripe_mode: stripeMode },
    });
    customerId = c.id;
    await supabaseAdmin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "brl",
          unit_amount: info.priceCents,
          product_data: {
            name: `Nova Temporada — ${info.challengeName}`,
            description:
              info.tier === "pro"
                ? "Reativação de desafio PRO (21 a 300 membros)"
                : "Reativação de desafio (até 20 membros)",
          },
        },
      },
    ],
    success_url: `${origin}/challenges?reactivated=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/challenges?reactivate_canceled=1`,
    metadata: {
      user_id: userId,
      reactivate_challenge_id: challengeId,
      reactivate_tier: info.tier,
      stripe_mode: stripeMode,
    },
  });

  return { url: session.url!, sessionId: session.id, info };
}

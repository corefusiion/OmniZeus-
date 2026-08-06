// Server-only Stripe helper. Nunca importar em componentes.
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";
import Stripe from "stripe";

let _client: Stripe | undefined;
let _clientKey: string | undefined;

function getStripeSecretKey(): string {
  const paymentMode = process.env.PAYMENT_MODE?.trim().toLowerCase();
  const candidates = paymentMode === "live"
    ? [
        process.env.PAYMENT_SECRET_KEY_LIVE,
        process.env.STRIPE_SECRET_KEY,
        process.env.PAYMENT_SECRET,
        process.env.PAYMENT_SECRET_KEY,
        process.env.PAYMENT_SECRET_KEY_TEST,
      ]
    : paymentMode === "test" || paymentMode === "sandbox"
      ? [
          process.env.PAYMENT_SECRET_KEY_TEST,
          process.env.STRIPE_SECRET_KEY,
          process.env.PAYMENT_SECRET,
          process.env.PAYMENT_SECRET_KEY,
          process.env.PAYMENT_SECRET_KEY_LIVE,
        ]
      : [
          process.env.STRIPE_SECRET_KEY,
          process.env.PAYMENT_SECRET,
          process.env.PAYMENT_SECRET_KEY,
          process.env.PAYMENT_SECRET_KEY_TEST,
          process.env.PAYMENT_SECRET_KEY_LIVE,
        ];
  const rawKey = candidates.find((value) => value?.trim());
  const key = rawKey?.trim();

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não configurado. Salve a chave secreta da Stripe, começando com sk_test_ ou sk_live_.");
  }
  if (key.startsWith("pk_")) {
    throw new Error("A chave configurada é publicável (pk_). Use a Secret key da Stripe, começando com sk_test_ ou sk_live_.");
  }
  if (key.startsWith("rk_")) {
    throw new Error("A chave configurada é restrita (rk_). Use a Secret key completa da Stripe, começando com sk_test_ ou sk_live_.");
  }
  if (!/^sk_(test|live)_/.test(key)) {
    throw new Error("Formato inválido da chave Stripe. Ela deve começar com sk_test_ ou sk_live_.");
  }
  if ((paymentMode === "live" && key.startsWith("sk_test_")) || ((paymentMode === "test" || paymentMode === "sandbox") && key.startsWith("sk_live_"))) {
    throw new Error("A chave Stripe configurada não combina com o modo de pagamento. Use sk_test_ para teste ou sk_live_ para live.");
  }

  return key;
}

export function getStripeMode(): "test" | "live" {
  return getStripeSecretKey().startsWith("sk_live_") ? "live" : "test";
}

export function getStripe(): Stripe {
  const key = getStripeSecretKey();
  if (_client && _clientKey === key) return _client;
  // Cloudflare Workers não tem Node http — precisa do fetch httpClient.
  _client = new Stripe(key, {
    apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
    httpClient: Stripe.createFetchHttpClient(),
  });
  _clientKey = key;
  return _client;
}

// Catálogo de produtos FitCrew. Preços em centavos (BRL).
export type SkuId =
  | "pro_monthly"
  | "pro_yearly"
  | "coins_100"
  | "coins_350"
  | "coins_800"
  | "coins_2000";

export const CATALOG: Record<
  SkuId,
  {
    name: string;
    description: string;
    amount: number; // centavos BRL
    kind: "subscription" | "one_time";
    interval?: "month" | "year";
    coins?: number;
    proDays?: number;
    proBonusCoins?: number;
    lookupKey: string; // usado pra buscar/criar Price
  }
> = {
  pro_monthly: {
    name: "FitCrew PRO — Mensal",
    description: "Até 300 membros por desafio, Selo Oficial, IA Anti-Trapaça ilimitada, ChatFit sem limite diário.",
    amount: 1990,
    kind: "subscription",
    interval: "month",
    proDays: 31,
    proBonusCoins: 100,
    lookupKey: "fitcrew_pro_monthly_brl",
  },
  pro_yearly: {
    name: "FitCrew PRO — Anual",
    description: "PRO por 1 ano inteiro (economia de ~2 meses).",
    amount: 19900,
    kind: "subscription",
    interval: "year",
    proDays: 366,
    proBonusCoins: 500,
    lookupKey: "fitcrew_pro_yearly_brl",
  },
  coins_100: {
    name: "Pacote Iniciante — 100 FitCoins",
    description: "100 🪙",
    amount: 990,
    kind: "one_time",
    coins: 100,
    lookupKey: "fitcrew_coins_100_brl",
  },
  coins_350: {
    name: "Pacote Atleta — 350 FitCoins",
    description: "350 🪙 (ganhe 50 bônus)",
    amount: 2990,
    kind: "one_time",
    coins: 350,
    lookupKey: "fitcrew_coins_350_brl",
  },
  coins_800: {
    name: "Pacote Monstro — 800 FitCoins",
    description: "800 🪙 (ganhe 200 bônus)",
    amount: 5990,
    kind: "one_time",
    coins: 800,
    lookupKey: "fitcrew_coins_800_brl",
  },
  coins_2000: {
    name: "Pacote Lenda — 2000 FitCoins",
    description: "2000 🪙 (ganhe 800 bônus)",
    amount: 11990,
    kind: "one_time",
    coins: 2000,
    lookupKey: "fitcrew_coins_2000_brl",
  },
};

/**
 * Garante que existe um Price ativo no Stripe para o SKU, criando produto+preço na primeira chamada.
 * Idempotente via lookup_key.
 */
export async function ensurePriceForSku(sku: SkuId): Promise<string> {
  const s = getStripe();
  const cfg = CATALOG[sku];
  const existing = await s.prices.list({ lookup_keys: [cfg.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const product = await s.products.create({
    name: cfg.name,
    description: cfg.description,
    metadata: { sku, coins: String(cfg.coins ?? 0), pro_days: String(cfg.proDays ?? 0) },
  });
  const price = await s.prices.create({
    product: product.id,
    unit_amount: cfg.amount,
    currency: "brl",
    lookup_key: cfg.lookupKey,
    ...(cfg.kind === "subscription" && cfg.interval
      ? { recurring: { interval: cfg.interval } }
      : {}),
  });
  return price.id;
}

export function siteOrigin(): string {
  try {
    const origin = getRequestHeader("origin");
    if (origin && /^https?:\/\//.test(origin)) return origin;

    const requestUrl = getRequestUrl();
    if (requestUrl) return new URL(requestUrl).origin;
  } catch {
    // Fora de um request TanStack (ex.: script/teste), usa fallback configurado.
  }

  return process.env.PUBLISHED_URL || "https://fitcrew.lovable.app";
}

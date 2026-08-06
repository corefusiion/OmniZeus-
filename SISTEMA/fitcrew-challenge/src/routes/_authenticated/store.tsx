import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Crown, Coins, Loader2, Sparkles, Palette, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyWallet, purchaseCosmetic } from "@/lib/monetization.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/store")({
  component: StorePage,
  head: () => ({
    meta: [
      { title: "Loja · FitCrew" },
      { name: "description", content: "FitCrew PRO, FitCoins e itens exclusivos." },
    ],
  }),
});

type Sku =
  | "pro_monthly"
  | "pro_yearly"
  | "coins_100"
  | "coins_350"
  | "coins_800"
  | "coins_2000";

const COIN_PACKS: Array<{ sku: Sku; label: string; coins: number; price: string; badge?: string }> = [
  { sku: "coins_100", label: "Iniciante", coins: 100, price: "R$ 9,90" },
  { sku: "coins_350", label: "Atleta", coins: 350, price: "R$ 29,90", badge: "+50 bônus" },
  { sku: "coins_800", label: "Monstro", coins: 800, price: "R$ 59,90", badge: "+200 bônus" },
  { sku: "coins_2000", label: "Lenda", coins: 2000, price: "R$ 119,90", badge: "+800 bônus" },
];

function checkoutApiUrl() {
  if (typeof window === "undefined") return "/api/public/checkout";

  const hostname = window.location.hostname;
  const isLovableRuntime =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com");

  return isLovableRuntime ? "/api/public/checkout" : "https://fitcrew.lovable.app/api/public/checkout";
}

async function openStripeCheckout(sku: Sku) {
  const { data: auth } = await supabase.auth.getSession();
  const token = auth.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente para comprar.");

  const response = await fetch(checkoutApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sku }),
  });

  const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? "Não foi possível iniciar o checkout.");
  if (!payload?.url) throw new Error("Não foi possível abrir o checkout da Stripe.");
  return { url: payload.url };
}

function StorePage() {
  const qc = useQueryClient();
  const walletFn = useServerFn(getMyWallet);
  const cosmeticFn = useServerFn(purchaseCosmetic);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["my-wallet"],
    queryFn: () => walletFn(),
  });

  // ao voltar do checkout com success=1, revalida wallet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      toast.success("Pagamento confirmado! Atualizando saldo…");
      const t = setTimeout(() => qc.invalidateQueries({ queryKey: ["my-wallet"] }), 1200);
      return () => clearTimeout(t);
    }
    if (params.get("canceled") === "1") toast("Compra cancelada.");
  }, [qc]);

  const checkoutMut = useMutation({
    mutationFn: (sku: Sku) => openStripeCheckout(sku),
    onSuccess: (res) => {
      if (!res?.url) {
        toast.error("Não foi possível abrir o checkout da Stripe.");
        return;
      }

      window.location.assign(res.url);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cosmeticMut = useMutation({
    mutationFn: (item: "gold_border" | "vip_title") => cosmeticFn({ data: { item } }),
    onSuccess: () => {
      toast.success("Item equipado por 30 dias! ✨");
      qc.invalidateQueries({ queryKey: ["my-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      {/* Header saldo */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white shadow-flame">
        <p className="text-xs uppercase tracking-wider opacity-90">Seu saldo</p>
        <div className="mt-1 flex items-baseline gap-2">
          <Coins className="size-6" />
          <span className="font-display text-4xl font-bold tabular-nums">
            {isLoading ? "…" : wallet?.balance ?? 0}
          </span>
          <span className="text-sm font-medium opacity-90">FitCoins</span>
        </div>
        {wallet?.isPro && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
            <Crown className="size-3.5" /> PRO até {new Date(wallet.proUntil!).toLocaleDateString("pt-BR")}
          </div>
        )}
      </div>

      {/* PRO */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">
          <Sparkles className="mr-1 inline size-5 text-amber-500" /> FitCrew PRO
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="rounded-2xl border-2 border-primary/30 bg-card p-5">
            <p className="text-sm text-muted-foreground">Mensal</p>
            <p className="mt-1 font-display text-3xl font-bold">R$ 19,90<span className="text-base font-normal text-muted-foreground">/mês</span></p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>✅ Até 300 membros/desafio</li>
              <li>✅ Selo Oficial no perfil</li>
              <li>✅ ChatFit ilimitado</li>
              <li>✅ IA Anti-Trapaça sempre grátis</li>
              <li>🎁 100 FitCoins de bônus</li>
            </ul>
            <Button
              className="mt-4 w-full rounded-full"
              disabled={checkoutMut.isPending || wallet?.isPro}
              onClick={() => checkoutMut.mutate("pro_monthly")}
            >
              {wallet?.isPro ? "Você já é PRO" : checkoutMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Assinar PRO"}
            </Button>
          </Card>
          <Card className="rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-50 to-orange-50 p-5 dark:from-amber-950/30 dark:to-orange-950/30">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Anual</p>
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">2 MESES GRÁTIS</span>
            </div>
            <p className="mt-1 font-display text-3xl font-bold">R$ 199<span className="text-base font-normal text-muted-foreground">/ano</span></p>
            <p className="mt-1 text-xs text-muted-foreground">≈ R$ 16,58/mês</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>✨ Todos os benefícios do PRO</li>
              <li>✨ 1 ano inteiro de PRO</li>
              <li>🎁 500 FitCoins de bônus</li>
            </ul>
            <Button
              className="mt-4 w-full rounded-full bg-amber-500 text-white hover:bg-amber-600"
              disabled={checkoutMut.isPending || wallet?.isPro}
              onClick={() => checkoutMut.mutate("pro_yearly")}
            >
              {checkoutMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Assinar Anual"}
            </Button>
          </Card>
        </div>
      </section>

      {/* FitCoins */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">
          <Coins className="mr-1 inline size-5 text-amber-500" /> Comprar FitCoins
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {COIN_PACKS.map((p) => (
            <Card key={p.sku} className="relative rounded-2xl border-border bg-card p-4">
              {p.badge && (
                <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {p.badge}
                </span>
              )}
              <p className="text-xs text-muted-foreground">{p.label}</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">🪙 {p.coins}</p>
              <p className="text-sm font-medium text-foreground">{p.price}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full rounded-full"
                disabled={checkoutMut.isPending}
                onClick={() => checkoutMut.mutate(p.sku)}
              >
                Comprar
              </Button>
            </Card>
          ))}
        </div>
      </section>

      {/* Cosméticos */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">
          <Palette className="mr-1 inline size-5 text-primary" /> Itens Premium
        </h2>
        <p className="text-xs text-muted-foreground">Gaste FitCoins pra brilhar no feed. Duração: 30 dias.</p>
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl p-4">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 p-1">
              <div className="grid size-full place-items-center rounded-full bg-background">
                <Crown className="size-6 text-amber-500" />
              </div>
            </div>
            <p className="mt-2 text-center font-display font-bold">Moldura Dourada</p>
            <p className="text-center text-xs text-muted-foreground">🪙 200 · 30 dias</p>
            <Button
              size="sm"
              className="mt-3 w-full rounded-full"
              disabled={cosmeticMut.isPending || (wallet?.balance ?? 0) < 200}
              onClick={() => cosmeticMut.mutate("gold_border")}
            >
              {wallet?.equippedBorder === "gold" ? "Equipada ✓" : "Equipar"}
            </Button>
          </Card>
          <Card className="rounded-2xl p-4">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10">
              <BadgeCheck className="size-8 text-primary" />
            </div>
            <p className="mt-2 text-center font-display font-bold">Nome VIP</p>
            <p className="text-center text-xs text-muted-foreground">🪙 150 · 30 dias</p>
            <Button
              size="sm"
              className="mt-3 w-full rounded-full"
              disabled={cosmeticMut.isPending || (wallet?.balance ?? 0) < 150}
              onClick={() => cosmeticMut.mutate("vip_title")}
            >
              {wallet?.equippedTitle === "vip" ? "Equipada ✓" : "Equipar"}
            </Button>
          </Card>
        </div>
      </section>

      {/* Status IA */}
      {wallet && !wallet.isPro && (
        <section className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="font-display font-bold">Uso de IA hoje</p>
          <p className="mt-1 text-muted-foreground">
            💬 ChatFit: {wallet.chatUsedToday}/{wallet.chatDailyLimit} mensagens · 📸 Análise de prato: {wallet.visionUsedThisMonth}/{wallet.visionMonthlyLimit} este mês
          </p>
        </section>
      )}
    </div>
  );
}

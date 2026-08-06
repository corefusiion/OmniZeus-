import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Package, Ticket, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/app-shell";
import {
  listStripeProducts,
  listPromotionCodes,
  createPromotionCode,
  deactivatePromotionCode,
} from "@/lib/admin-finance.functions";

export const Route = createFileRoute("/_authenticated/admin/finance")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.user.id);
    const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
    if (!isSuper) throw redirect({ to: "/admin" });
  },
  component: AdminFinance,
});

function formatBrl(cents: number | null) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminFinance() {
  const listProductsFn = useServerFn(listStripeProducts);
  const listPromosFn = useServerFn(listPromotionCodes);
  const createPromoFn = useServerFn(createPromotionCode);
  const deactivatePromoFn = useServerFn(deactivatePromotionCode);
  const qc = useQueryClient();

  const productsQ = useQuery({
    queryKey: ["admin-finance", "products"],
    queryFn: () => listProductsFn(),
  });
  const promosQ = useQuery({
    queryKey: ["admin-finance", "promos"],
    queryFn: () => listPromosFn(),
  });

  const [code, setCode] = React.useState("");
  const [percentOff, setPercentOff] = React.useState<string>("10");
  const [maxRedemptions, setMaxRedemptions] = React.useState<string>("");
  const [expiresInDays, setExpiresInDays] = React.useState<string>("30");

  const createMut = useMutation({
    mutationFn: () =>
      createPromoFn({
        data: {
          code,
          percentOff: percentOff ? Number(percentOff) : undefined,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
          duration: "once",
        },
      }),
    onSuccess: () => {
      toast.success("Cupom criado!");
      setCode("");
      qc.invalidateQueries({ queryKey: ["admin-finance", "promos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar cupom"),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivatePromoFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Cupom desativado");
      qc.invalidateQueries({ queryKey: ["admin-finance", "promos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao desativar"),
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        title="💰 Financeiro & Cupons"
        subtitle="Produtos ativos na Stripe e cupons promocionais da plataforma."
      />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Package className="size-5" /> Produtos Stripe
        </h2>
        {productsQ.isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {productsQ.error && (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {(productsQ.error as any).message}
          </p>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {(productsQ.data ?? []).map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-semibold">{p.name}</p>
              {p.description && (
                <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
              )}
              <ul className="mt-2 space-y-1 text-sm">
                {p.prices.map((pr) => (
                  <li key={pr.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {pr.lookup_key ?? pr.id}
                      {pr.recurring ? ` · /${pr.recurring.interval}` : ""}
                    </span>
                    <span className="font-medium">{formatBrl(pr.unit_amount)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Ticket className="size-5" /> Criar Promotion Code
        </h2>
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="code">Código</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="FITCREW10"
            />
          </div>
          <div>
            <Label htmlFor="percent">% Desconto</Label>
            <Input
              id="percent"
              type="number"
              min={1}
              max={100}
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="max">Máx. usos</Label>
            <Input
              id="max"
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="ilimitado"
            />
          </div>
          <div>
            <Label htmlFor="exp">Expira em (dias)</Label>
            <Input
              id="exp"
              type="number"
              min={1}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !code || !percentOff}
              className="rounded-full"
            >
              {createMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Criar cupom
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Cupons ativos</h2>
        {promosQ.isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <ul className="space-y-2">
          {(promosQ.data ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <div>
                <p className="font-mono text-sm font-semibold">{c.code}</p>
                <p className="text-xs text-muted-foreground">
                  {c.coupon.percent_off
                    ? `${c.coupon.percent_off}% off`
                    : `${formatBrl(c.coupon.amount_off)} off`}{" "}
                  · usado {c.times_redeemed}
                  {c.max_redemptions ? `/${c.max_redemptions}` : ""} vezes
                  {!c.active ? " · inativo" : ""}
                </p>
              </div>
              {c.active && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deactivateMut.mutate(c.id)}
                  disabled={deactivateMut.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
          {(promosQ.data ?? []).length === 0 && !promosQ.isLoading && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum cupom criado ainda.
            </p>
          )}
        </ul>
      </section>
    </div>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";

import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { listPendingWithdraws, markWithdrawPaid } from "@/lib/affiliate.functions";

export const Route = createFileRoute("/_authenticated/admin/withdrawals")({
  beforeLoad: ({ context }) => {
    const { isSuperAdmin } = context as { isSuperAdmin?: boolean };
    if (!isSuperAdmin) throw redirect({ to: "/admin" });
  },
  component: WithdrawalsPage,
});

function WithdrawalsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingWithdraws);
  const markFn = useServerFn(markWithdrawPaid);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals-pending"],
    queryFn: () => listFn({}),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Marcado como pago!");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals-pending"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Chave Pix copiada!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="💸 Pedidos de saque"
        subtitle="Pague o Pix pelo seu banco e marque como pago para fechar o ciclo."
      />

      {isLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum pedido pendente. 🎉
        </p>
      )}

      <ul className="grid gap-3">
        {(data ?? []).map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold">
                {r.user?.display_name ?? "?"}
                {r.user?.username && (
                  <span className="ml-2 text-xs text-muted-foreground">@{r.user.username}</span>
                )}
              </p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                R$ {Number(r.amount).toFixed(2).replace(".", ",")}
              </p>
              <div className="flex items-center gap-2">
                <code className="rounded-lg bg-muted px-2 py-1 text-xs break-all">{r.pix_key}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full"
                  onClick={() => copyKey(r.pix_key)}
                >
                  <Copy className="size-3.5" /> Copiar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Solicitado em {new Date(r.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              disabled={markPaid.isPending}
              onClick={() => markPaid.mutate(r.id)}
            >
              ✅ Marcar como pago
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

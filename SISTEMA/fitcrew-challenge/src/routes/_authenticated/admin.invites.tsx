import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X, Copy, Loader2, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app-shell";
import {
  listInviteRequests,
  approveInviteRequest,
  rejectInviteRequest,
} from "@/lib/invites.functions";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  component: AdminInvitesPage,
});

type Status = "pending" | "approved" | "rejected" | "all";

function AdminInvitesPage() {
  const [status, setStatus] = React.useState<Status>("pending");
  const listFn = useServerFn(listInviteRequests);
  const approveFn = useServerFn(approveInviteRequest);
  const rejectFn = useServerFn(rejectInviteRequest);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invite-requests", status],
    queryFn: () => listFn({ data: { status } }),
  });

  const requests = data?.requests ?? [];

  async function handleApprove(id: string, email: string) {
    try {
      const res = await approveFn({ data: { id } });
      await navigator.clipboard.writeText(res.code).catch(() => {});
      if (res.emailSent) {
        toast.success(`Convite ${res.code} enviado`, {
          description: `Email disparado pra ${email}. Código também copiado.`,
        });
      } else {
        toast.warning(`Convite ${res.code} gerado (email falhou)`, {
          description: res.emailError
            ? `Copiado. Envie manual pra ${email}. Motivo: ${res.emailError}`
            : `Copiado. Envie manual pra ${email}.`,
        });
      }
      qc.invalidateQueries({ queryKey: ["invite-requests"] });
    } catch (err) {
      toast.error("Não deu pra aprovar", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectFn({ data: { id } });
      toast.success("Solicitação rejeitada");
      qc.invalidateQueries({ queryKey: ["invite-requests"] });
    } catch (err) {
      toast.error("Não deu pra rejeitar", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Solicitações de convite"
        subtitle="Analise quem pediu acesso e libere um código de convite se aprovar."
      />

      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              status === s
                ? "bg-primary text-primary-foreground shadow-flame"
                : "border border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "pending" && "Pendentes"}
            {s === "approved" && "Aprovadas"}
            {s === "rejected" && "Rejeitadas"}
            {s === "all" && "Todas"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center text-muted-foreground">
          <Inbox className="size-8 opacity-40" />
          <p className="mt-3 text-sm">Nenhuma solicitação {status !== "all" ? "nessa categoria" : "ainda"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => (
            <RequestRow
              key={r.id}
              row={r}
              onApprove={() => handleApprove(r.id, r.email)}
              onReject={() => handleReject(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({
  row,
  onApprove,
  onReject,
}: {
  row: {
    id: string;
    email: string;
    name: string | null;
    message: string | null;
    status: string;
    invite_id: string | null;
    reviewed_at: string | null;
    created_at: string;
  };
  onApprove: () => void;
  onReject: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const pending = row.status === "pending";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{row.name || row.email}</p>
            <StatusBadge status={row.status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.email} · {new Date(row.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        {pending && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onReject();
                setBusy(false);
              }}
            >
              <X className="mr-1 size-4" /> Rejeitar
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onApprove();
                setBusy(false);
              }}
            >
              <Check className="mr-1 size-4" /> Aprovar e gerar código
            </Button>
          </div>
        )}
      </div>

      {row.message && (
        <p className="mt-3 whitespace-pre-line rounded-lg bg-muted/60 p-3 text-sm text-foreground/80">
          {row.message}
        </p>
      )}

      {row.status === "approved" && row.invite_id && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Copy className="size-3" /> Código gerado (veja em Convites).
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "bg-amber-500/15 text-amber-600" },
    approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-600" },
    rejected: { label: "Rejeitado", cls: "bg-rose-500/15 text-rose-600" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

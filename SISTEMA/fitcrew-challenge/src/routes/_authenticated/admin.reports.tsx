import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/relative-time";
import { listCheckinReports, resolveCheckinReport } from "@/lib/checkin-reports.functions";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
  },
  component: ReportsPage,
});

function ReportsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCheckinReports);
  const resolveFn = useServerFn(resolveCheckinReport);

  const { data, isLoading } = useQuery({
    queryKey: ["checkin-reports", "pending"],
    queryFn: () => listFn({ data: { status: "pending" as const } }),
  });

  const resolveMut = useMutation({
    mutationFn: (v: { id: string; action: "dismiss" | "uphold" }) => resolveFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "uphold" ? "Denúncia aceita — check-in rejeitado." : "Denúncia descartada.");
      qc.invalidateQueries({ queryKey: ["checkin-reports"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["ranking-v2"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Denúncias"
        subtitle="Check-ins reportados pela comunidade. Julgue e mantenha o jogo justo."
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <Flag className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-display text-lg font-bold">Nenhuma denúncia pendente</p>
          <p className="text-sm text-muted-foreground">Quando alguém denunciar, aparece aqui.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it: any) => (
            <li key={it.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-destructive">
                  <Flag className="mr-1 inline size-3" /> Denúncia
                </span>
                <RelativeTime iso={it.created_at} />
                <span>
                  por <strong>{it.reporter?.display_name ?? "?"}</strong>
                </span>
                {it.checkin?.total_reports && it.checkin.total_reports > 1 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600">
                    {it.checkin.total_reports} denúncias no mesmo check-in
                  </span>
                )}
              </div>
              <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm italic">"{it.reason}"</p>

              {it.checkin && (
                <div className="mt-3 rounded-2xl border border-border bg-background p-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    Check-in de <strong>{it.checkin.author?.display_name ?? "?"}</strong> · {it.checkin.duration_min}min · {it.checkin.occurred_on}
                  </div>
                  {it.checkin.photo_signed_url && (
                    <img
                      src={it.checkin.photo_signed_url}
                      alt="Check-in denunciado"
                      className="mb-2 max-h-64 w-full rounded-xl object-cover"
                    />
                  )}
                  {it.checkin.caption && <p className="text-sm">{it.checkin.caption}</p>}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-full"
                  disabled={resolveMut.isPending}
                  onClick={() => resolveMut.mutate({ id: it.id, action: "uphold" })}
                >
                  <Check className="mr-1 size-4" /> Aceitar (rejeitar check-in)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={resolveMut.isPending}
                  onClick={() => resolveMut.mutate({ id: it.id, action: "dismiss" })}
                >
                  <X className="mr-1 size-4" /> Descartar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

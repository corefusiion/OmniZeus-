import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Bot, Mail, Sparkles, Flag, DollarSign, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app-shell";
import { setCheckinValidation } from "@/lib/admin.functions";
import { listInviteRequests } from "@/lib/invites.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminPage,
});

function PendingInvitesBadge() {
  const listFn = useServerFn(listInviteRequests);
  const { data } = useQuery({
    queryKey: ["invite-requests", "pending", "count"],
    queryFn: () => listFn({ data: { status: "pending" } }),
    refetchOnWindowFocus: true,
  });
  const count = data?.requests?.length ?? 0;
  if (!count) return null;
  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
      {count}
    </span>
  );
}

function AdminPage() {
  const { isSuperAdmin } = Route.useRouteContext();
  const validateFn = useServerFn(setCheckinValidation);

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Painel do admin"
        subtitle="Moderação da plataforma. As regras de cada desafio ficam dentro do próprio desafio."
      />

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <p className="font-semibold">Editando regras de um desafio?</p>
        <p className="mt-1 text-muted-foreground">
          Cada desafio tem suas próprias regras, exercícios e premiação. Abra o desafio em{" "}
          <Link to="/challenges" className="font-semibold text-primary underline">
            Desafios
          </Link>{" "}
          e vá em <strong>Configurações</strong> (aba visível só pra donos e co-admins).
        </p>
      </div>

      {isSuperAdmin && (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/invites"
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary shadow-soft hover:bg-primary/15"
          >
            <Mail className="size-4" /> Solicitações de convite
            <PendingInvitesBadge />
          </Link>
          <Link
            to="/admin/reports"
            className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive shadow-soft hover:bg-destructive/15"
          >
            <Flag className="size-4" /> Denúncias
          </Link>
          <Link
            to="/admin/warnings"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft hover:bg-muted"
          >
            <ShieldAlert className="size-4" /> Trust & Safety
          </Link>
          <Link
            to="/admin/moderation"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft hover:bg-muted"
          >
            <Bot className="size-4" /> Moderação IA
          </Link>
          <Link
            to="/admin/ai"
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary shadow-soft hover:bg-primary/15"
          >
            <Sparkles className="size-4" /> Configurações de IA
          </Link>
          <Link
            to="/admin/finance"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 shadow-soft hover:bg-emerald-500/15 dark:text-emerald-400"
          >
            <DollarSign className="size-4" /> Financeiro & Cupons
          </Link>
          <Link
            to="/admin/withdrawals"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 shadow-soft hover:bg-emerald-500/15 dark:text-emerald-400"
          >
            <Wallet className="size-4" /> Pedidos de saque
          </Link>
        </div>
      )}

      <AiReviewQueue validateFn={validateFn} />
    </div>
  );
}

const REASON_LABEL: Record<string, string> = {
  gallery: "📁 Foto da galeria",
  no_exif: "🕒 Sem EXIF",
  photo_old_24h: "📅 Foto com +24h",
};

function AiReviewQueue({ validateFn }: { validateFn: any }) {
  const qc = useQueryClient();
  const [notesById, setNotesById] = React.useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["ai-review-queue"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("checkins") as any)
        .select(
          "id, user_id, occurred_on, duration_min, photo_url, caption, ai_notes, created_at, ai_validated, photo_flag_codes, photo_flag_reason",
        )
        .eq("ai_validated", "needs_review")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const paths = rows.map((r) => r.photo_url).filter(Boolean);
      const signedMap = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("checkin-photos").createSignedUrls(paths, 3600);
        (signed ?? []).forEach((s) => {
          if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl);
        });
      }
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      const profileMap = new Map<string, { display_name: string; username: string | null }>();
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, username").in("id", userIds);
        (profs ?? []).forEach((p) => profileMap.set(p.id, { display_name: p.display_name, username: p.username ?? null }));
      }
      return rows.map((r) => ({
        ...r,
        photo_signed_url: r.photo_url ? signedMap.get(r.photo_url) ?? null : null,
        author: profileMap.get(r.user_id) ?? null,
      }));
    },
  });

  const decide = async (id: string, status: "approved" | "rejected") => {
    try {
      await validateFn({ data: { checkinId: id, status, notes: notesById[id]?.trim() || undefined } });
      toast.success(status === "approved" ? "Aprovado" : "Rejeitado");
      qc.invalidateQueries({ queryKey: ["ai-review-queue"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["ranking-v2"] });
      qc.invalidateQueries({ queryKey: ["challenge-ranking"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold">Fila de revisão de check-ins</h2>
      <p className="text-xs text-muted-foreground">
        Check-ins marcados pelo sistema (foto suspeita) ou pela IA. Não confundir com solicitações de convite — essas ficam no botão acima.
      </p>
      {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nada aguardando revisão. 🎉
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {(data ?? []).map((r: any) => {
          const codes: string[] = Array.isArray(r.photo_flag_codes) ? r.photo_flag_codes : [];
          return (
            <li key={r.id} className="overflow-hidden rounded-2xl border border-amber-500/40 bg-card">
              {r.photo_signed_url && (
                <img src={r.photo_signed_url} alt="check-in" className="h-40 w-full object-cover" />
              )}
              <div className="space-y-2 p-3">
                <p className="text-xs text-muted-foreground">
                  {r.author?.display_name ?? "?"} · {r.occurred_on} · {r.duration_min}min
                </p>
                {r.caption && <p className="text-sm">{r.caption}</p>}

                {(codes.length > 0 || r.photo_flag_reason) && (
                  <div className="rounded-xl bg-amber-500/5 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Motivos da marcação
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {codes.map((c) => (
                        <span
                          key={c}
                          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                        >
                          {REASON_LABEL[c] ?? c}
                        </span>
                      ))}
                    </div>
                    {r.photo_flag_reason && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{r.photo_flag_reason}</p>
                    )}
                  </div>
                )}

                {r.ai_notes && <p className="text-[11px] italic text-muted-foreground">IA: {r.ai_notes}</p>}

                <textarea
                  placeholder="Observação (opcional, salva na auditoria)"
                  value={notesById[r.id] ?? ""}
                  onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  maxLength={500}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border bg-background p-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 rounded-full" onClick={() => decide(r.id, "approved")}>
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-full text-destructive"
                    onClick={() => decide(r.id, "rejected")}
                  >
                    Rejeitar
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

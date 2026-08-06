import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, Swords, X, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { listDuelsForChallenge, respondDuel, resolveExpiredDuels, type DuelRow } from "@/lib/duels.functions";
import { getChallengeHub } from "@/lib/challenge-hub.functions";

export const Route = createFileRoute("/_authenticated/c/$id/duels")({
  component: DuelsPage,
  errorComponent: ({ error }) => (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div>Nada por aqui.</div>,
});

const STATUS_LABEL: Record<DuelRow["status"], { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  accepted: { label: "Em andamento", className: "bg-primary/15 text-primary" },
  resolved: { label: "Finalizado", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  declined: { label: "Recusado", className: "bg-muted text-muted-foreground" },
  canceled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

function PersonMini({
  p,
  isWinner,
}: {
  p: DuelRow["challenger"];
  isWinner?: boolean;
}) {
  const name = p?.username ? `@${p.username}` : p?.display_name ?? "—";
  const initials = (p?.display_name ?? "??").slice(0, 2).toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-9">
        <AvatarImage src={p?.avatar_url ?? undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="flex items-center gap-1 truncate font-display text-sm font-bold">
          {isWinner && <Trophy className="size-3.5 text-primary" />}
          {name}
        </p>
      </div>
    </div>
  );
}

function DuelsPage() {
  const { id } = Route.useParams();
  const hubFn = useServerFn(getChallengeHub);
  const listFn = useServerFn(listDuelsForChallenge);
  const respondFn = useServerFn(respondDuel);
  const qc = useQueryClient();

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const resolveFn = useServerFn(resolveExpiredDuels);
  useEffect(() => {
    resolveFn({ data: { challengeId: id } })
      .then((r) => {
        if (r?.resolved) qc.invalidateQueries({ queryKey: ["duels", id] });
      })
      .catch(() => undefined);
  }, [id, resolveFn, qc]);

  const { data: hub } = useQuery({
    queryKey: ["challenge-hub", id],
    queryFn: () => hubFn({ data: { challengeId: id } }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["duels", id],
    queryFn: () => listFn({ data: { challengeId: id } }),
  });

  const mutation = useMutation({
    mutationFn: (v: { duelId: string; action: "accept" | "decline" | "cancel" }) =>
      respondFn({ data: v }),
    onSuccess: (_r, v) => {
      const msg =
        v.action === "accept"
          ? "Duelo aceito! 🔥"
          : v.action === "decline"
            ? "Duelo recusado."
            : "Duelo cancelado.";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["duels", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { pendingForMe, ongoing, finished, other } = useMemo(() => {
    const duels = data?.duels ?? [];
    const week = data?.week_start;
    const pendingForMe: DuelRow[] = [];
    const ongoing: DuelRow[] = [];
    const finished: DuelRow[] = [];
    const other: DuelRow[] = [];
    for (const d of duels) {
      if (d.status === "pending") {
        if (meId && d.opponent_id === meId && d.week_start === week) pendingForMe.push(d);
        else ongoing.push(d);
      } else if (d.status === "accepted") {
        ongoing.push(d);
      } else if (d.status === "resolved") {
        finished.push(d);
      } else {
        other.push(d);
      }
    }
    return { pendingForMe, ongoing, finished, other };
  }, [data, meId]);

  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      <BackButton
        to="/c/$id"
        params={{ id }}
        label={hub?.challenge.name ? `Voltar para ${hub.challenge.name}` : "Voltar"}
      />
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
          <Swords className="size-6 text-primary" /> Duelos
        </h1>
        <p className="text-sm text-muted-foreground">
          Todos os 1v1 entre membros de {hub?.challenge.name ?? "este desafio"}.
        </p>
      </div>

      {isLoading && (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {!isLoading && (data?.duels.length ?? 0) === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Swords className="mx-auto size-8 text-primary" />
          <h2 className="mt-4 font-display text-xl font-bold">Nenhum duelo ainda</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vá para <span className="font-semibold">Classificações</span> e clique em{" "}
            <span className="font-semibold">Desafiar</span> ao lado de outro membro para começar
            um 1v1.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/c/$id/ranking" params={{ id }}>Ir para Classificações</Link>
          </Button>
        </div>
      )}

      {pendingForMe.length > 0 && (
        <Section title="Aguardando sua resposta" tone="primary">
          {pendingForMe.map((d) => (
            <DuelCard
              key={d.id}
              d={d}
              meId={meId}
              busy={mutation.isPending}
              onAction={(action) => mutation.mutate({ duelId: d.id, action })}
            />
          ))}
        </Section>
      )}

      {ongoing.length > 0 && (
        <Section title="Em andamento">
          {ongoing.map((d) => (
            <DuelCard
              key={d.id}
              d={d}
              meId={meId}
              busy={mutation.isPending}
              onAction={(action) => mutation.mutate({ duelId: d.id, action })}
            />
          ))}
        </Section>
      )}

      {finished.length > 0 && (
        <Section title="Finalizados">
          {finished.map((d) => (
            <DuelCard key={d.id} d={d} meId={meId} busy={false} onAction={() => {}} />
          ))}
        </Section>
      )}

      {other.length > 0 && (
        <Section title="Recusados / cancelados">
          {other.map((d) => (
            <DuelCard key={d.id} d={d} meId={meId} busy={false} onAction={() => {}} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "primary";
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2
        className={`text-xs font-semibold uppercase tracking-wider ${
          tone === "primary" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {title}
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function DuelCard({
  d,
  meId,
  busy,
  onAction,
}: {
  d: DuelRow;
  meId: string | null;
  busy: boolean;
  onAction: (a: "accept" | "decline" | "cancel") => void;
}) {
  const status = STATUS_LABEL[d.status];
  const iAmChallenger = meId != null && d.challenger_id === meId;
  const iAmOpponent = meId != null && d.opponent_id === meId;
  const winner =
    d.status === "resolved" && d.winner_id
      ? d.winner_id === d.challenger_id
        ? "challenger"
        : d.winner_id === d.opponent_id
          ? "opponent"
          : null
      : null;

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge className={`rounded-full ${status.className} hover:${status.className}`}>
          {status.label}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Semana de{" "}
          {new Date(d.week_start + "T00:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}{" "}
          · aposta{" "}
          <span className="font-bold text-foreground">
            {d.stake_points} {d.stake_points === 1 ? "pt" : "pts"}
          </span>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <PersonMini p={d.challenger} isWinner={winner === "challenger"} />
        <div className="text-center">
          <p className="font-display text-lg font-bold text-muted-foreground">VS</p>
          {d.status === "resolved" && (
            <p className="text-xs text-muted-foreground">
              {d.challenger_points ?? 0} × {d.opponent_points ?? 0}
              {d.tied && " · empate"}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <PersonMini p={d.opponent} isWinner={winner === "opponent"} />
        </div>
      </div>

      {d.status === "pending" && iAmOpponent && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => onAction("decline")}
          >
            <X className="mr-1 size-4" /> Recusar
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => onAction("accept")}
          >
            {busy ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Check className="mr-1 size-4" />
            )}
            Aceitar
          </Button>
        </div>
      )}

      {d.status === "pending" && iAmChallenger && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onAction("cancel")}
          >
            Cancelar convite
          </Button>
        </div>
      )}
    </li>
  );
}

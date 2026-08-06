import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Medal, Trophy, Coins } from "lucide-react";
import { SectionHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { fetchActiveChallenge } from "@/lib/checkins.queries";
import { getRankingWithTiebreak, type TiebreakCriterion } from "@/lib/ranking.functions";

export const Route = createFileRoute("/_authenticated/ranking")({
  component: RankingPage,
  errorComponent: ({ error }) => (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div>Nada por aqui.</div>,
});

const CRITERION_LABEL: Record<TiebreakCriterion, string> = {
  days: "Mais dias treinados",
  duration: "Mais minutos totais",
  first_to_reach: "Chegou primeiro à pontuação",
  weight_evolution: "Maior evolução %",
  daily_pose: "Mais Poses do Dia",
};

function money(v: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

function RankingPage() {
  const { data: challenge } = useQuery({
    queryKey: ["active-challenge"],
    queryFn: fetchActiveChallenge,
  });
  const rankingFn = useServerFn(getRankingWithTiebreak);
  const { data, isLoading } = useQuery({
    queryKey: ["ranking-v2", challenge?.id],
    enabled: !!challenge?.id,
    queryFn: () => rankingFn({ data: { challengeId: challenge!.id } }),
  });

  const rows = data?.rows ?? [];
  const pot = data?.pot;

  return (
    <>
      <SectionHeader
        title="Ranking"
        subtitle={
          challenge
            ? `${challenge.name} · máx ${challenge.max_days_per_week} dias/semana contando`
            : "Placar da temporada ativa."
        }
      />

      {data && (
        <div className="mb-4 grid gap-3 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-soft sm:grid-cols-[1fr_auto]">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Coins className="size-4" /> Pote da temporada
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              {money(pot?.total ?? 0, data.challenge.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pot?.participants ?? 0} participantes · entrada {money(data.challenge.entry_fee, data.challenge.currency)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
            {data.challenge.prize_split
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((p) => (
                <div key={p.position} className="rounded-xl border border-border bg-background px-3 py-2 text-center sm:min-w-[9rem]">
                  <p className="text-xs text-muted-foreground">
                    {p.position === 1 ? "🥇" : p.position === 2 ? "🥈" : p.position === 3 ? "🥉" : `#${p.position}`}
                  </p>
                  <p className="font-display text-base font-bold">
                    {money(((pot?.total ?? 0) * p.percent) / 100, data.challenge.currency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{p.percent}%</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const rank = i + 1;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            return (
              <li key={r.user_id}>
                <Link
                  to="/profile/$userId"
                  params={{ userId: r.user_id }}
                  className={`flex items-center gap-4 rounded-2xl border p-4 shadow-soft transition hover:border-primary/50 ${
                    rank === 1 ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary font-display text-lg font-bold">
                    {medal ?? rank}
                  </div>
                  <Avatar className="size-10 border border-border">
                    <AvatarImage src={r.avatar_url ?? undefined} />
                    <AvatarFallback>{r.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold">{r.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.counted_days} {r.counted_days === 1 ? "dia" : "dias"} · {r.total_minutes}min
                      {r.tiebreak_applied && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">
                          desempate: {CRITERION_LABEL[r.tiebreak_applied]}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-bold leading-none">{r.total_points}</p>
                    <p className="text-xs text-muted-foreground">pontos</p>
                    {r.prize_amount != null && r.prize_amount > 0 && (
                      <Badge className="mt-1 rounded-full bg-primary/15 text-primary hover:bg-primary/15">
                        {money(r.prize_amount, data!.challenge.currency)}
                      </Badge>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {!isLoading && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Medal className="mx-auto size-8 text-primary" />
          <h2 className="mt-4 font-display text-xl font-bold">Placar vazio</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Assim que rolar o primeiro check-in, o ranking começa.
          </p>
        </div>
      )}

      {rows.length > 0 && data && (
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Trophy className="size-3" /> Desempate:&nbsp;
          {data.challenge.tiebreakers.map((t, i) => (
            <span key={t}>
              {i > 0 && " → "}
              {CRITERION_LABEL[t]}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

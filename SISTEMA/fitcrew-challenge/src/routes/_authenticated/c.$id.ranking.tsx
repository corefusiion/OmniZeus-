import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Flame, Loader2, Medal, Swords, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import { supabase } from "@/integrations/supabase/client";
import { getChallengeHub } from "@/lib/challenge-hub.functions";
import { getRankingWithTiebreak, type TiebreakCriterion } from "@/lib/ranking.functions";
import { listDuelsForChallenge, resolveExpiredDuels, getDuelWinsForChallenge } from "@/lib/duels.functions";
import { getPokeStatus, pokeUser } from "@/lib/pokes.functions";
import { DuelInviteModal } from "@/components/challenge/duel-invite-modal";
import { FollowButton } from "@/components/follow-button";
import { ShareVictoryButton } from "@/components/share/share-victory-button";




export const Route = createFileRoute("/_authenticated/c/$id/ranking")({
  component: ChallengeRankingPage,
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

function ChallengeRankingPage() {
  const { id } = Route.useParams();
  const rankingFn = useServerFn(getRankingWithTiebreak);
  const hubFn = useServerFn(getChallengeHub);
  const duelsFn = useServerFn(listDuelsForChallenge);
  const pokeStatusFn = useServerFn(getPokeStatus);
  const pokeFn = useServerFn(pokeUser);
  const queryClient = useQueryClient();

  const pokeMutation = useMutation({
    mutationFn: (targetId: string) =>
      pokeFn({ data: { challengeId: id, targetId } }),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success("🔥 Cutucada enviada! O Coach já foi no feed.");
        queryClient.invalidateQueries({ queryKey: ["timeline"] });
      } else {
        const map: Record<string, string> = {
          self: "Cutucar a si mesmo? Foca no treino 💪",
          not_slacking: "Esse aí tá em dia, deixa quieto 😌",
          already_poked: "Você já cutucou essa pessoa nas últimas 24h.",
          target_cap: "Ela já tá levando muita cutucada hoje 😅",
        };
        toast.error(map[res?.reason] ?? "Não deu pra cutucar agora.");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cutucar."),
  });


  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const [duelTarget, setDuelTarget] = useState<{
    user_id: string;
    display_name: string;
    username?: string | null;
    avatar_url?: string | null;
  } | null>(null);

  const { data: hub } = useQuery({
    queryKey: ["challenge-hub", id],
    queryFn: () => hubFn({ data: { challengeId: id } }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["challenge-ranking", id],
    queryFn: () => rankingFn({ data: { challengeId: id } }),
  });

  const { data: duelsData } = useQuery({
    queryKey: ["duels", id],
    queryFn: () => duelsFn({ data: { challengeId: id } }),
  });

  // Lazily resolve any accepted duels whose 7-day window has expired.
  const resolveFn = useServerFn(resolveExpiredDuels);
  useEffect(() => {
    resolveFn({ data: { challengeId: id } })
      .then((r) => {
        if (r?.resolved) queryClient.invalidateQueries({ queryKey: ["duels", id] });
      })
      .catch(() => undefined);
  }, [id, resolveFn, queryClient]);

  const duelWinsFn = useServerFn(getDuelWinsForChallenge);
  const { data: duelWinsData } = useQuery({
    queryKey: ["duel-wins", id],
    queryFn: () => duelWinsFn({ data: { challengeId: id } }),
    staleTime: 30_000,
  });
  const duelWins = duelWinsData?.wins ?? {};

  const { data: pokeData } = useQuery({
    queryKey: ["poke-status", id],
    queryFn: () => pokeStatusFn({ data: { challengeId: id } }),
    refetchInterval: 60_000,
  });

  const pokeByUser = new Map<string, { hours: number | null; slacking: boolean }>();
  for (const r of pokeData?.rows ?? []) {
    pokeByUser.set(r.user_id, { hours: r.hours_since, slacking: r.is_slacking });
  }


  const rows = data?.rows ?? [];
  const showFinancials = hub?.financials != null;

  // Map opponent user_id -> duel status (relative to me, this week)
  const currentWeek = duelsData?.week_start;
  const duelByUser = new Map<
    string,
    { status: string; stake: number; iAmChallenger: boolean }
  >();
  if (meId && duelsData) {
    for (const d of duelsData.duels) {
      if (d.week_start !== currentWeek) continue;
      if (d.challenger_id === meId) {
        duelByUser.set(d.opponent_id, {
          status: d.status,
          stake: d.stake_points,
          iAmChallenger: true,
        });
      } else if (d.opponent_id === meId) {
        duelByUser.set(d.challenger_id, {
          status: d.status,
          stake: d.stake_points,
          iAmChallenger: false,
        });
      }
    }
  }


  return (
    <div className="space-y-4 pb-24 lg:pb-8">
      <div className="flex items-center gap-2">
        <BackButton
          to="/c/$id"
          params={{ id }}
          label={hub?.challenge.name ? `Voltar para ${hub.challenge.name}` : "Voltar"}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 sm:px-0">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Classificações</h1>
          <p className="truncate text-sm text-muted-foreground">
            {hub?.challenge.name ?? "Placar do desafio"}
          </p>
        </div>
        {meId && hub?.challenge.name && (() => {
          const mine = rows.find((r) => r.user_id === meId);
          if (!mine) return null;
          const position = rows.findIndex((r) => r.user_id === meId) + 1;
          return (
            <ShareVictoryButton
              size="sm"
              variant="outline"
              className="rounded-full border-primary/40 text-primary hover:bg-primary/10"
              label="Compartilhar"
              data={{
                displayName: mine.display_name,
                avatarUrl: mine.avatar_url,
                challengeName: hub.challenge.name,
                position,
                totalPoints: Math.round(mine.total_points),
                countedDays: mine.counted_days,
              }}
            />
          );
        })()}
      </div>



      {/* Pote — só visível para admins (dono/co_admin/super-admin) */}
      {showFinancials && data && (
        <div className="grid gap-3 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-soft sm:grid-cols-[1fr_auto]">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              <Coins className="size-4" /> Pote da temporada
            </p>
            <p className="mt-1 font-display text-3xl font-bold">
              {money(data.pot?.total ?? 0, data.challenge.currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.pot?.participants ?? 0} participantes · entrada{" "}
              {money(data.challenge.entry_fee, data.challenge.currency)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1">
            {data.challenge.prize_split
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((p) => (
                <div
                  key={p.position}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-center sm:min-w-[9rem]"
                >
                  <p className="text-xs text-muted-foreground">
                    {p.position === 1
                      ? "🥇"
                      : p.position === 2
                        ? "🥈"
                        : p.position === 3
                          ? "🥉"
                          : `#${p.position}`}
                  </p>
                  <p className="font-display text-base font-bold">
                    {money(
                      ((data.pot?.total ?? 0) * p.percent) / 100,
                      data.challenge.currency,
                    )}
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

      {!isLoading && rows.length > 0 && data && (
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
                    <p className="flex items-center gap-1.5 truncate font-display text-base font-bold">
                      <span className="truncate">{r.display_name}</span>
                      {duelWins[r.user_id] > 0 && (
                        <span
                          title={`${duelWins[r.user_id]} vitória${duelWins[r.user_id] > 1 ? "s" : ""} em duelo`}
                          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                        >
                          ⚔️ {duelWins[r.user_id]}
                        </span>
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {r.counted_days} {r.counted_days === 1 ? "dia" : "dias"} · {r.total_minutes}min
                      </span>
                      {r.tiebreak_applied && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">
                          desempate: {CRITERION_LABEL[r.tiebreak_applied]}
                        </span>
                      )}
                      {r.pending_review > 0 && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                          ⏳ {r.pending_review} em revisão
                        </span>
                      )}
                      {r.rejected > 0 && (
                        <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          ✕ {r.rejected} reprovado{r.rejected > 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-right">
                      <p className="font-display text-2xl font-bold leading-none">
                        {r.total_points}
                      </p>
                      <p className="text-xs text-muted-foreground">pontos</p>
                      {showFinancials && r.prize_amount != null && r.prize_amount > 0 && (
                        <Badge className="mt-1 rounded-full bg-primary/15 text-primary hover:bg-primary/15">
                          {money(r.prize_amount, data.challenge.currency)}
                        </Badge>
                      )}
                    </div>
                    {meId && r.user_id !== meId && (
                      <div onClick={(e) => e.preventDefault()}>
                        <FollowButton userId={r.user_id} size="sm" className="h-7 px-2.5 text-[11px]" />
                      </div>
                    )}
                    {meId && r.user_id !== meId && (() => {
                      const duel = duelByUser.get(r.user_id);
                      if (duel?.status === "pending") {
                        return (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                            {duel.iAmChallenger ? "Enviado ⏳" : "Aguardando você"}
                          </span>
                        );
                      }
                      if (duel?.status === "accepted") {
                        return (
                          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            ⚔️ Em duelo · {duel.stake}pt
                          </span>
                        );
                      }
                      if (duel?.status === "declined" || duel?.status === "canceled") {
                        return (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            Semana encerrada
                          </span>
                        );
                      }
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-full border-primary/40 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/10"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDuelTarget({
                              user_id: r.user_id,
                              display_name: r.display_name,
                              avatar_url: r.avatar_url,
                            });
                          }}
                        >
                          <Swords className="mr-1 size-3.5" />
                          Desafiar
                        </Button>
                      );
                    })()}
                    {meId && r.user_id !== meId && (() => {
                      const p = pokeByUser.get(r.user_id);
                      const slacking = p?.slacking ?? true; // no check-ins yet counts as slacking
                      if (!slacking) {
                        return (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            Em dia ✅
                          </span>
                        );
                      }
                      const hoursLabel =
                        p?.hours == null
                          ? "sem check-in"
                          : p.hours >= 48
                            ? `${Math.floor(p.hours / 24)}d sem treinar`
                            : `${Math.floor(p.hours)}h sem treinar`;
                      const busy =
                        pokeMutation.isPending &&
                        pokeMutation.variables === r.user_id;
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pokeMutation.isPending}
                          className="h-7 rounded-full border-orange-500/40 bg-orange-500/5 px-2.5 text-[11px] font-semibold text-orange-600 hover:bg-orange-500/15"
                          title={hoursLabel}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            pokeMutation.mutate(r.user_id);
                          }}
                        >
                          {busy ? (
                            <Loader2 className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <Flame className="mr-1 size-3.5" />
                          )}
                          Cutucar
                        </Button>
                      );
                    })()}
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
        <p className="mt-6 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Trophy className="size-3" /> Desempate:&nbsp;
          {data.challenge.tiebreakers.map((t, i) => (
            <span key={t}>
              {i > 0 && " → "}
              {CRITERION_LABEL[t]}
            </span>
          ))}
        </p>
      )}
      {duelTarget && (
        <DuelInviteModal
          open={!!duelTarget}
          onOpenChange={(v) => !v && setDuelTarget(null)}
          challengeId={id}
          opponent={duelTarget}
        />
      )}
    </div>
  );
}


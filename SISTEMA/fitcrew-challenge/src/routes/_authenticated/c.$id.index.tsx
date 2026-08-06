import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Coins,
  Copy,
  Crown,
  Flame,
  Loader2,
  Share2,
  Shield,
  Trophy,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StoryBar } from "@/components/challenge/story-bar";
import { ChallengeBanner } from "@/components/challenge/challenge-banner";
import { BannerPickerModal } from "@/components/challenge/banner-picker-modal";

import { QrInviteModal } from "@/components/challenge/qr-invite-modal";
import { PendingDuelsBanner } from "@/components/challenge/pending-duels-banner";
import { RulesDialog } from "@/components/challenge/rules-dialog";
import { supabase } from "@/integrations/supabase/client";
import { getChallengeHub } from "@/lib/challenge-hub.functions";
import { rotateInviteCode, setInviteEnabled, joinChallengeAsSuperAdmin } from "@/lib/challenges.functions";
import { setChallengePublic } from "@/lib/explore.functions";
import { getRouletteStatus, spinRoulette } from "@/lib/roulette.functions";
import { RouletteModal } from "@/components/challenge/roulette-modal";
import { RouletteHowItWorks } from "@/components/challenge/roulette-how-it-works";
import { QrCode } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/c/$id/")({
  component: ChallengeDetailPage,
  errorComponent: ({ error }) => (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      Desafio não encontrado.
    </div>
  ),
});

function money(v: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

function ChallengeDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const hubFn = useServerFn(getChallengeHub);
  const rotateFn = useServerFn(rotateInviteCode);
  const setEnabledFn = useServerFn(setInviteEnabled);
  const setPublicFn = useServerFn(setChallengePublic);
  const rouletteStatusFn = useServerFn(getRouletteStatus);
  const spinFn = useServerFn(spinRoulette);
  const joinAsSuperFn = useServerFn(joinChallengeAsSuperAdmin);
  const [meId, setMeId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [rouletteDemo, setRouletteDemo] = useState<null | {
    eligible: boolean;
    prize: { key: string; label: string; tier: "coin" | "points" | "troll"; points: number; emoji: string } | null;
  }>(null);
  const [rouletteData, setRouletteData] = useState<{
    eligible: boolean;
    countedDays: number;
    requiredDays: number;
    prize: { key: string; label: string; tier: "coin" | "points" | "troll"; points: number; emoji?: string } | null;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["challenge-hub", id],
    queryFn: () => hubFn({ data: { challengeId: id } }),
  });

  // Auto-abre a roleta na segunda-feira (uma vez por semana, apenas 1x por dia)
  useEffect(() => {
    let cancelled = false;
    rouletteStatusFn({ data: { challengeId: id } })
      .then((s) => {
        if (cancelled || !s.shouldShow) return;
        // Só mostra 1x por dia por desafio: usamos localStorage para lembrar
        const today = new Date().toISOString().slice(0, 10);
        const dismissKey = `roulette-dismissed:${id}:${s.weekStart}:${today}`;
        if (typeof window !== "undefined" && window.localStorage.getItem(dismissKey)) return;
        setRouletteData({
          eligible: s.eligible,
          countedDays: s.countedDays,
          requiredDays: s.requiredDays,
          prize: null,
        });
        setRouletteOpen(true);
        try {
          window.localStorage.setItem(dismissKey, "1");
        } catch {}
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, rouletteStatusFn]);

  const handleRealSpin = async () => {
    const res = await spinFn({ data: { challengeId: id } });
    if (res.prize) {
      const p = res.prize as { key: string; label: string; tier: "coin" | "points" | "troll"; points: number; emoji?: string };
      setRouletteData((prev) => (prev ? { ...prev, prize: p } : prev));
    }
  };


  const handleDemoSpin = async () => {
    // Mock: sorteia local para preview visual
    const { PRIZES } = await import("@/lib/roulette.functions");
    const pick = PRIZES[Math.floor(Math.random() * PRIZES.length)];
    await new Promise((r) => setTimeout(r, 400));
    setRouletteDemo({
      eligible: true,
      prize: {
        key: pick.key,
        label: pick.label,
        tier: pick.tier,
        points: pick.points,
        emoji: pick.emoji,
      },
    });
  };


  const rotateMut = useMutation({
    mutationFn: () => rotateFn({ data: { challengeId: id } }),
    onSuccess: () => {
      toast.success("Código rotacionado.");
      qc.invalidateQueries({ queryKey: ["challenge-hub", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleInviteMut = useMutation({
    mutationFn: (enabled: boolean) => setEnabledFn({ data: { challengeId: id, enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenge-hub", id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const togglePublicMut = useMutation({
    mutationFn: (isPublic: boolean) => setPublicFn({ data: { challengeId: id, isPublic } }),
    onSuccess: (_r, isPublic) => {
      toast.success(isPublic ? "Desafio publicado em Explorar." : "Desafio agora é privado.");
      qc.invalidateQueries({ queryKey: ["challenge-hub", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const joinAsSuperMut = useMutation({
    mutationFn: () => joinAsSuperFn({ data: { challengeId: id } }),
    onSuccess: () => {
      toast.success("Você entrou no desafio como Super Admin.");
      qc.invalidateQueries({ queryKey: ["challenge-hub", id] });
      qc.invalidateQueries({ queryKey: ["my-challenges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  const { challenge, role, stats, top_ranking, financials, my_streak } = data;
  const isAdmin = role === "owner" || role === "co_admin" || role === "super_admin";
  const inviteUrl =
    typeof window !== "undefined" && challenge.invite_code
      ? `${window.location.origin}/join/${challenge.invite_code}`
      : "";

  const handleShare = async () => {
    if (!inviteUrl) return;
    const shareData = {
      title: challenge.name,
      text: `Bora treinar juntos no desafio "${challenge.name}"?`,
      url: inviteUrl,
    };
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share(shareData);
        return;
      } catch {
        /* fallthrough para clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link de convite copiado!");
    } catch {
      toast.error("Não deu para copiar o link.");
    }
  };

  return (
    <div className="space-y-6">
      {!role && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/30 bg-primary/5 p-4 shadow-soft">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">
              {data.is_super_admin
                ? "Modo Super Admin — você está apenas visualizando este desafio"
                : "Você ainda não participa deste desafio"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.is_super_admin
                ? "Entre sem convite para gerenciar membros, moderar ou participar do ranking."
                : "Peça o código de convite ao criador para entrar e começar a somar pontos."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.is_super_admin && (
              <Button
                size="sm"
                variant="destructive"
                className="rounded-full"
                disabled={joinAsSuperMut.isPending}
                onClick={() => joinAsSuperMut.mutate()}
              >
                {joinAsSuperMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Shield className="size-4" /> Entrar como Super Admin
                  </>
                )}
              </Button>
            )}
            {challenge.invite_code && challenge.invite_enabled ? (
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/join/$code" params={{ code: challenge.invite_code }}>
                  Solicitar entrada
                </Link>
              </Button>
            ) : (
              !data.is_super_admin && (
                <Badge variant="outline" className="rounded-full">
                  Convites fechados
                </Badge>
              )
            )}
          </div>
        </div>
      )}

      {/* Banner do desafio */}
      <ChallengeBanner bannerPath={(challenge as any).banner_url ?? null} name={challenge.name} />

      {/* Stories 24h */}
      <StoryBar challengeId={id} meUserId={meId} />

      {/* Duelos pendentes aguardando resposta do usuário */}
      {role && <PendingDuelsBanner challengeId={id} />}




      {/* Header do desafio */}
      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate font-display text-2xl font-bold sm:text-3xl">
                {challenge.name}
              </h1>
              {!challenge.is_active && (
                <Badge variant="outline" className="rounded-full text-muted-foreground">
                  inativo
                </Badge>
              )}
              {role === "owner" && (
                <Badge className="rounded-full bg-primary text-primary-foreground">
                  <Crown className="mr-1 size-3" /> Dono
                </Badge>
              )}
              {role === "co_admin" && (
                <Badge variant="secondary" className="rounded-full">
                  <Shield className="mr-1 size-3" /> Co-ADM
                </Badge>
              )}
              {role === "super_admin" && (
                <Badge variant="outline" className="rounded-full border-primary/40 text-primary">
                  Super-admin
                </Badge>
              )}
            </div>
            {challenge.description && (
              <p className="mt-2 text-sm text-muted-foreground">{challenge.description}</p>
            )}
          </div>
          {isAdmin && (
            <Link
              to="/c/$id/settings"
              params={{ id }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
            >
              <Shield className="size-4" /> Painel
            </Link>
          )}
          {role !== "owner" && role !== "super_admin" && (
            <Link
              to="/c/$id/settings"
              params={{ id }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
              title="Sair do desafio"
            >
              Sair do desafio
            </Link>
          )}
        </div>


        {/* Progresso */}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
              Progresso
            </span>
            <span className="text-muted-foreground">
              {stats.days_elapsed}/{stats.days_total} dias · {stats.days_remaining} restantes
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-[width] duration-500"
              style={{ width: `${stats.progress_pct}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {new Date(challenge.starts_at + "T00:00:00").toLocaleDateString("pt-BR")}
              <span className="mx-1">→</span>
              {new Date(challenge.ends_at + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
            <span>·</span>
            <span>Máx {challenge.max_days_per_week} dias/semana contando</span>
          </div>
        </div>

        {/* Convite */}
        {challenge.invite_code && challenge.invite_enabled && (
          <div className="mt-5 space-y-3 rounded-2xl border border-border bg-background/60 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Código de convite
              </p>
              <p className="mt-1 truncate font-mono text-2xl font-bold tracking-wider">
                {challenge.invite_code}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(challenge.invite_code!);
                  toast.success("Código copiado!");
                }}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
              >
                <Copy className="size-3.5" /> Copiar
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
              >
                <QrCode className="size-3.5" /> QR
              </button>
              <RulesDialog
                challenge={challenge}
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary"
                  >
                    <Flame className="size-3.5" /> Regras
                  </button>
                }
              />
              <button
                type="button"
                onClick={handleShare}
                className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-flame hover:opacity-90 sm:col-span-1"
              >
                <Share2 className="size-3.5" /> Convidar
              </button>
            </div>
          </div>
        )}
        {challenge.invite_code && inviteUrl && (
          <QrInviteModal
            open={qrOpen}
            onClose={() => setQrOpen(false)}
            inviteUrl={inviteUrl}
            inviteCode={challenge.invite_code}
            challengeName={challenge.name}
          />
        )}
        {isAdmin && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => rotateMut.mutate()}
              disabled={rotateMut.isPending}
              className="rounded-full border border-border bg-card px-3 py-1.5 font-semibold text-muted-foreground hover:bg-secondary"
            >
              {rotateMut.isPending ? "Gerando…" : "Gerar novo código"}
            </button>
            <button
              type="button"
              onClick={() => toggleInviteMut.mutate(!challenge.invite_enabled)}
              disabled={toggleInviteMut.isPending}
              className="rounded-full border border-border bg-card px-3 py-1.5 font-semibold text-muted-foreground hover:bg-secondary"
            >
              {challenge.invite_enabled ? "Desativar convite" : "Ativar convite"}
            </button>
            <button
              type="button"
              onClick={() => togglePublicMut.mutate(!challenge.is_public)}
              disabled={togglePublicMut.isPending}
              className={`rounded-full border px-3 py-1.5 font-semibold hover:bg-secondary ${
                challenge.is_public
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {challenge.is_public ? "🌎 Público em Explorar" : "Tornar público"}
            </button>
            <button
              type="button"
              onClick={() => setBannerOpen(true)}
              className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 font-semibold text-primary hover:bg-primary/10"
            >
              ✨ Trocar capa
            </button>
          </div>
        )}
      </section>

      {/* Cartão de teste da roleta (demo — visível a todos) */}
      <div className="rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
        <button
          type="button"
          onClick={() => setRouletteDemo({ eligible: true, prize: null })}
          className="flex w-full items-center gap-3 text-left"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/20 text-2xl">
            🎰
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold">Roleta da Semana (demo)</p>
            <p className="text-xs text-muted-foreground">
              Prévia visual — a versão oficial aparece toda segunda para quem
              fechou a semana 100%.
            </p>
          </div>
        </button>
        <div className="mt-2 flex justify-end">
          <RouletteHowItWorks />
        </div>
      </div>


      {isAdmin && (
        <BannerPickerModal
          challengeId={id}
          open={bannerOpen}
          onOpenChange={setBannerOpen}
        />
      )}

      {/* Roleta real (segundas + registrada no banco) */}
      {rouletteData && (
        <RouletteModal
          open={rouletteOpen}
          onClose={() => setRouletteOpen(false)}
          eligible={rouletteData.eligible}
          countedDays={rouletteData.countedDays}
          requiredDays={rouletteData.requiredDays}
          prize={rouletteData.prize}
          onSpin={handleRealSpin}
        />
      )}

      {/* Roleta demo (preview a qualquer hora) */}
      {rouletteDemo && (
        <RouletteModal
          open={!!rouletteDemo}
          onClose={() => setRouletteDemo(null)}
          eligible={rouletteDemo.eligible}
          countedDays={0}
          requiredDays={0}
          prize={rouletteDemo.prize}
          onSpin={handleDemoSpin}
        />
      )}



      {/* Streak banner */}
      {my_streak.current > 0 && (
        <section
          className={`flex items-center gap-3 rounded-3xl border p-4 shadow-soft ${
            my_streak.checked_in_today
              ? "border-primary/30 bg-gradient-to-r from-primary/10 via-card to-card"
              : "border-orange-500/40 bg-gradient-to-r from-orange-500/10 via-card to-card"
          }`}
        >
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange-500/20 text-orange-500">
            <Flame className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">
              🔥 {my_streak.current} {my_streak.current === 1 ? "dia" : "dias"} seguido{my_streak.current === 1 ? "" : "s"}!
            </p>
            <p className="text-xs text-muted-foreground">
              {my_streak.checked_in_today
                ? `Recorde pessoal: ${my_streak.longest} dias · check-in de hoje ✅`
                : "Faça o check-in de hoje para não perder a sequência."}
            </p>
          </div>
          {!my_streak.checked_in_today && (
            <Link
              to="/checkin"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-flame hover:opacity-90"
            >
              Check-in
            </Link>
          )}
        </section>
      )}

      {/* Estatísticas do grupo */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
          <Activity className="size-4 text-primary" /> Estatísticas do grupo
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Activity} label="Check-ins totais" value={stats.total_checkins.toLocaleString("pt-BR")} />
          <StatCard icon={CalendarDays} label="Dias ativos" value={stats.active_days} />
          <StatCard icon={Users} label="Participantes" value={stats.participants} />
          <StatCard icon={UserRound} label="Média por dia" value={stats.avg_per_day} />
        </div>
      </section>

      {/* Mini-ranking */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Trophy className="size-4 text-primary" /> Classificações
          </h2>
          <Link
            to="/c/$id/ranking"
            params={{ id }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {top_ranking.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Placar vazio — o primeiro check-in inaugura o ranking.
          </div>
        ) : (
          <ol className="space-y-2">
            {top_ranking.map((r, i) => {
              const rank = i + 1;
              const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}º`;
              return (
                <li key={r.user_id}>
                  <Link
                    to="/profile/$userId"
                    params={{ userId: r.user_id }}
                    className={`flex items-center gap-3 rounded-2xl border p-3 shadow-soft transition hover:border-primary/50 ${
                      rank === 1 ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-display font-bold">
                      {medal}
                    </div>
                    <Avatar className="size-9 border border-border">
                      <AvatarImage src={r.avatar_url ?? undefined} />
                      <AvatarFallback>{r.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold">{r.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.counted_days} {r.counted_days === 1 ? "dia" : "dias"} ativo
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl font-bold leading-none">
                        {r.total_points}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        pontos
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Bloco financeiro (SÓ admin) */}
      {financials && (
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <h2 className="font-display text-lg font-bold">Financeiro</h2>
            <Badge variant="outline" className="ml-auto rounded-full border-primary/40 text-[10px] uppercase tracking-wider text-primary">
              Somente admin
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Valor de entrada
              </p>
              <p className="mt-1 font-display text-xl font-bold">
                {money(financials.entry_fee, financials.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pote acumulado
              </p>
              <p className="mt-1 flex items-center gap-1 font-display text-xl font-bold">
                <Coins className="size-4 text-primary" />
                {money(financials.pot_total, financials.currency)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/60 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pagamentos
              </p>
              <p className="mt-1 font-display text-xl font-bold">
                {financials.participants_paid}
                <span className="text-sm font-medium text-muted-foreground">
                  {" "}
                  / {financials.participants_total}
                </span>
              </p>
            </div>
          </div>

          {financials.prize_split.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Distribuição de prêmios
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {financials.prize_split.map((p) => (
                  <div
                    key={p.position}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-center"
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
                        (financials.pot_total * p.percent) / 100,
                        financials.currency,
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{p.percent}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Este bloco só é visível para o dono, co-admins e super-admin.
          </p>
        </section>
      )}

      <div className="pb-24 lg:pb-8" />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

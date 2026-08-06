import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Users, Calendar, Flame, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FitCrewLogo } from "@/components/brand/fitcrew-logo";
import { getInvitePreview } from "@/lib/invite-preview.functions";
import { getChallengeStatus } from "@/lib/challenge-status";
import type { InvitePreviewPodium } from "@/lib/invite-preview.functions";

export const Route = createFileRoute("/invite/$code")({
  loader: async ({ params }) => {
    const preview = await getInvitePreview({ data: { code: params.code } });
    return { preview, code: params.code };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.preview?.challenge;
    const title = c
      ? `Você foi convocado para a Crew: ${c.name}`
      : "Convite FitCrew";
    const description = c
      ? `Entre na disputa "${c.name}" no FitCrew. Registre treinos, dispute pontos e prove sua consistência.`
      : "Registre treinos, dispute pontos com sua crew no FitCrew.";
    const meta: Array<{ title?: string; name?: string; property?: string; content?: string }> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (c?.banner_url) {
      meta.push({ property: "og:image", content: c.banner_url });
      meta.push({ name: "twitter:image", content: c.banner_url });
    }
    return { meta };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center">
      <Trophy className="mx-auto size-10 text-muted-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">Convite inválido ou expirado.</p>
      <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground">
        Ir para o FitCrew
      </Link>
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Convite não encontrado.</div>,
  component: InviteLandingPage,
});

function InviteLandingPage() {
  const { preview, code } = Route.useLoaderData();

  if (!preview) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Trophy className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 font-display text-xl font-bold">Convite inválido</p>
        <p className="mt-2 text-sm text-muted-foreground">
          O link expirou ou os convites deste desafio foram desativados.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
        >
          Voltar
        </Link>
      </div>
    );
  }

  const { challenge, podium } = preview;
  const status = getChallengeStatus(challenge.starts_at, challenge.ends_at);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-background via-background to-primary/5 pb-16">
      {/* Banner hero */}
      <div className="relative">
        <div className="relative h-52 overflow-hidden sm:h-72">
          {challenge.banner_url ? (
            <img
              src={challenge.banner_url}
              alt={challenge.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full bg-gradient-to-br from-primary/40 via-primary/20 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <FitCrewLogo size={28} withGlow />
          <span className="font-display text-sm font-bold tracking-wide">FitCrew</span>
        </div>
      </div>

      <div className="mx-auto -mt-20 max-w-lg space-y-6 px-4">
        {/* Convocação card */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/95 p-6 shadow-xl backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            🔥 Você foi convocado
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight sm:text-4xl">
            para a Crew: {challenge.name}
          </h1>
          {challenge.description && (
            <p className="mt-3 text-sm text-muted-foreground">{challenge.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-semibold">
              <Calendar className="size-3" />
              {status.label}
            </span>
            {challenge.member_count != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-semibold">
                <Users className="size-3" />
                {challenge.member_count} {challenge.member_count === 1 ? "guerreiro" : "guerreiros"}
              </span>
            )}
            {challenge.max_days_per_week && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-semibold">
                <Flame className="size-3" />
                {challenge.max_days_per_week}x/semana
              </span>
            )}
          </div>
        </div>

        {/* Pódio */}
        {podium.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              🏆 Quem manda no jogo hoje
            </p>
            <div className="space-y-2">
              {podium.map((p: InvitePreviewPodium, i: number) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      i === 0
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="grid size-9 shrink-0 place-items-center text-lg">{medal}</div>
                    <Avatar className="size-10 border border-border">
                      <AvatarImage src={p.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {p.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold">
                        {p.display_name}
                      </p>
                      {p.username && (
                        <p className="truncate text-xs text-muted-foreground">
                          @{p.username}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold leading-none">
                        {Math.round(Number(p.total_points))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs italic text-muted-foreground">
              Vai deixar eles ganharem sozinhos?
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-3xl border-2 border-primary bg-primary/5 p-6 text-center shadow-soft">
          <p className="font-display text-lg font-bold">
            Registre treinos. Ganhe pontos. Domine o ranking.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Sem check-in, sem chance. Sua reputação começa agora.
          </p>
          <Link
            to="/auth"
            search={{ join: code, mode: "invite" as const }}
            className="mt-5 block"
          >
            <Button size="lg" className="w-full rounded-full font-display text-base font-bold">
              Aceitar o desafio
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </Link>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Já tem conta?{" "}
            <Link
              to="/auth"
              search={{ join: code, mode: "signin" as const }}
              className="font-semibold text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Código do convite: <span className="font-mono font-bold">{code}</span>
        </p>
      </div>
    </div>
  );
}

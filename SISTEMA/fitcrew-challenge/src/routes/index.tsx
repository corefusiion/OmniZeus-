import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Trophy,
  Flame,
  Bot,
  Swords,
  Users,
  Link2,
  Target,
  Dumbbell,
  Medal,
  Building2,
  ArrowRight,
  CheckCircle2,
  Zap,
  UserX,
  BatteryLow,
  Frown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FitCrewLogo } from "@/components/brand/fitcrew-logo";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "FitCrew — Sua Crew, sua competição, seus resultados" },
      {
        name: "description",
        content:
          "Crie uma Crew, desafie seus amigos e transforme seus treinos numa competição que você não vai querer perder. Ranking, streaks, IA anti-migué e duelos 1v1.",
      },
      { property: "og:title", content: "FitCrew — Sua Crew, sua competição" },
      {
        property: "og:description",
        content:
          "Crie uma Crew, desafie seus amigos e transforme seus treinos numa competição que você não vai querer perder.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://fitcrew.lovable.app/" },
      { property: "og:image", content: "https://fitcrew.lovable.app/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://fitcrew.lovable.app/og-image.jpg" },
    ],
    links: [
      { rel: "canonical", href: "https://fitcrew.lovable.app/" },
    ],
  }),
});

/**
 * Landing dark athletic — tokens locais via `.dark` + overrides inline.
 *   bg #0D0D0F · surface #1A1A1F · border #2A2A35
 *   primary #FF5A1F · lime #AAFF45 · fg #FFFFFF · muted #A0A0A8
 * Display: Syne · Body: Inter.
 */
const landingTheme: React.CSSProperties = {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  ...({
    "--background": "#0D0D0F",
    "--foreground": "#FFFFFF",
    "--card": "#141419",
    "--card-foreground": "#FFFFFF",
    "--popover": "#1A1A1F",
    "--popover-foreground": "#FFFFFF",
    "--primary": "#FF5A1F",
    "--primary-foreground": "#FFFFFF",
    "--secondary": "#1A1A1F",
    "--secondary-foreground": "#FFFFFF",
    "--muted": "#1A1A1F",
    "--muted-foreground": "#A0A0A8",
    "--accent": "#2A2A35",
    "--accent-foreground": "#FFFFFF",
    "--border": "#2A2A35",
    "--input": "#2A2A35",
    "--ring": "#FF5A1F",
    "--success": "#AAFF45",
    "--success-foreground": "#0D0D0F",
    "--font-display": '"Outfit", ui-sans-serif, system-ui, sans-serif',
    "--font-sans": '"Inter", ui-sans-serif, system-ui, sans-serif',
  } as React.CSSProperties),
};

const LIME = "#AAFF45";
const CREATE_HREF = "/auth" as const;

function LandingPage() {
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="dark" style={landingTheme}>
      <div className="relative min-h-screen bg-background text-foreground antialiased">
        <NoiseBackdrop />

        {/* NAVBAR */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <FitCrewLogo size={36} withGlow />
              <span className="font-display text-xl font-extrabold tracking-tight">
                FitCrew
              </span>
            </div>
            <nav className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-md border border-white/15 bg-transparent hover:bg-white/5"
              >
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-[#FF6A2F]"
              >
                <Link to={CREATE_HREF}>Criar Crew</Link>
              </Button>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-32 sm:px-6">
          {/* HERO */}
          <section className="relative grid gap-10 pt-10 sm:pt-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-20">
            <div className="pointer-events-none absolute -left-32 top-10 -z-0 size-96 rounded-full bg-primary/20 blur-[120px]" />
            <div
              className="pointer-events-none absolute -right-24 -top-10 -z-0 size-96 rounded-full blur-[120px]"
              style={{ background: `${LIME}22` }}
            />

            <div className="relative animate-fade-in text-center lg:text-left">
              <Kicker tone="lime">🔥 Temporada aberta · Competição entre amigos</Kicker>

              <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Seus amigos estão treinando.{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #FF9A3C 0%, #FF5A1F 45%, #E11D00 100%)",
                  }}
                >
                  Você vai ficar
                </span>{" "}
                para trás?
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                Crie uma Crew, desafie seus amigos e transforme seus treinos em uma
                competição que você não vai querer perder.
              </p>

              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground/80 lg:mx-0">
                Registre seus treinos, mantenha seu streak, ganhe pontos e suba no ranking.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Button
                  asChild
                  size="lg"
                  className="rounded-md bg-primary px-6 text-base font-bold text-primary-foreground shadow-[0_10px_40px_-10px_#FF5A1F] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FF6A2F]"
                >
                  <Link to={CREATE_HREF}>
                    🔥 CRIAR MINHA CREW GRÁTIS
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => setJoinOpen(true)}
                  className="rounded-md border border-white/20 bg-transparent px-6 text-base font-bold hover:bg-white/5"
                >
                  ENTRAR EM UMA CREW
                </Button>
              </div>

              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" style={{ color: LIME }} />
                  Grátis para começar
                </span>
                <span className="text-white/25">·</span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" style={{ color: LIME }} />
                  Sem cartão
                </span>
                <span className="text-white/25">·</span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" style={{ color: LIME }} />
                  Crie em 1 minuto
                </span>
              </p>
            </div>

            {/* Mockup do Ranking */}
            <div className="relative mx-auto w-full max-w-[420px] lg:max-w-none">
              <div
                className="absolute inset-0 -z-10 rounded-[2.5rem] blur-3xl"
                style={{
                  background:
                    "radial-gradient(60% 60% at 50% 40%, #FF5A1F44, transparent 70%)",
                }}
              />
              <HeroMockup />
            </div>
          </section>

          {/* PROBLEMA */}
          <RevealSection className="mt-28 lg:mt-36">
            <SectionHead
              kicker="O problema"
              kickerTone="lime"
              sub="Todo mundo já começou animado e largou em duas semanas. O problema não é preguiça — é falta de gente do lado."
            >
              Treinar sozinho é fácil de abandonar.
            </SectionHead>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <ProblemCard
                icon={<UserX className="size-5" />}
                title="Sozinho é fácil faltar"
                text="Ninguém sabe se você treinou. Segunda-feira vira quarta, quarta vira nunca."
              />
              <ProblemCard
                icon={<BatteryLow className="size-5" />}
                title="Sem competição, a motivação cai"
                text="Não existe ranking, não existe placar. Sem motivo pra voltar amanhã."
              />
              <ProblemCard
                icon={<Frown className="size-5" />}
                title="Sem ninguém cobrando, você desiste"
                text="Quando sua Crew percebe sua ausência, fica muito difícil sumir de novo."
              />
            </div>
          </RevealSection>

          {/* SOLUÇÃO — BENTO GRID */}
          <RevealSection className="mt-28 lg:mt-36">
            <SectionHead
              kicker="A solução"
              sub="Ranking, streak, IA fiscalizando e duelos entre amigos. Tudo num lugar só."
            >
              Transforme seus amigos no{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #FF9A3C, #FF5A1F, #E11D00)",
                }}
              >
                motivo
              </span>{" "}
              para não faltar.
            </SectionHead>

            <div className="mt-12 grid gap-4 lg:grid-cols-6 lg:grid-rows-2">
              {/* Ranking — grande */}
              <BentoCard
                className="lg:col-span-4 lg:row-span-1"
                icon={<Trophy className="size-5" />}
                emoji="🏆"
                title="Ranking ao Vivo"
                text="Veja quem está na frente. Placar atualiza a cada check-in — o topo é disputa real."
                tone="primary"
              >
                <MiniRanking />
              </BentoCard>

              {/* Streak */}
              <BentoCard
                className="lg:col-span-2 lg:row-span-1"
                icon={<Flame className="size-5" />}
                emoji="🔥"
                title="Streak"
                text="Mantenha a sequência. Um dia perdido zera tudo. A crew tá olhando."
                tone="lime"
              >
                <StreakVisual />
              </BentoCard>

              {/* IA */}
              <BentoCard
                className="lg:col-span-2 lg:row-span-1"
                icon={<Bot className="size-5" />}
                emoji="🤖"
                title="IA Anti-Migué"
                text="O FitBot fiscaliza foto do treino e da comida. Ninguém dá aquela geladinha."
                tone="lime"
              >
                <IAVisual />
              </BentoCard>

              {/* Duelos */}
              <BentoCard
                className="lg:col-span-4 lg:row-span-1"
                icon={<Swords className="size-5" />}
                emoji="⚔️"
                title="Duelos e Zoação"
                text="Provoque seus amigos no feed. Duelos 1v1 semanais valendo pontos — e o direito de zoar."
                tone="primary"
              >
                <DuelsVisual />
              </BentoCard>
            </div>
          </RevealSection>

          {/* COMO FUNCIONA */}
          <RevealSection className="mt-28 lg:mt-36">
            <SectionHead kicker="Como funciona">
              Cinco passos.{" "}
              <span className="text-primary">Uma competição.</span> Zero desculpas.
            </SectionHead>

            <ol className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <TimelineStep
                n={1}
                icon={<Users className="size-5" />}
                title="Crie sua Crew"
                text="Em 1 minuto. Sem cartão."
              />
              <TimelineStep
                n={2}
                icon={<Link2 className="size-5" />}
                title="Convide a galera"
                text="Via link direto no zap."
              />
              <TimelineStep
                n={3}
                icon={<Target className="size-5" />}
                title="Crie o desafio"
                text="Defina regras, dias e pontos."
              />
              <TimelineStep
                n={4}
                icon={<Dumbbell className="size-5" />}
                title="Treine e pontue"
                text="Check-in diário, foto do treino."
              />
              <TimelineStep
                n={5}
                icon={<Medal className="size-5" />}
                title="Domine o ranking"
                text="Não seja o último. Ninguém quer."
                last
              />
            </ol>
          </RevealSection>

          {/* B2B */}
          <RevealSection className="mt-28 lg:mt-36">
            <div
              className="relative overflow-hidden rounded-[2rem] border border-border p-8 sm:p-12 lg:p-14"
              style={{
                background:
                  "linear-gradient(135deg, #0A0F14 0%, #0D0D0F 55%, #0D0D0F 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute -left-24 top-1/2 size-80 -translate-y-1/2 rounded-full blur-3xl"
                style={{ background: `${LIME}18` }}
              />
              <div className="pointer-events-none absolute -right-24 -bottom-24 size-80 rounded-full bg-primary/15 blur-3xl" />

              <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
                <div>
                  <Kicker tone="lime">
                    <Building2 className="size-3.5" /> Para academias e assessorias
                  </Kicker>
                  <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                    Você tem uma academia ou é{" "}
                    <span style={{ color: LIME }}>Personal Trainer?</span>
                  </h2>
                  <p className="mt-4 max-w-xl text-muted-foreground">
                    Transforme seus alunos em uma comunidade viciada em treinar. Crie
                    desafios exclusivos, aumente a retenção e monetize com o{" "}
                    <span className="font-semibold text-foreground">FitCrew PRO</span>.
                  </p>
                  <div className="mt-6">
                    <Button
                      asChild
                      variant="ghost"
                      size="lg"
                      className="rounded-md border border-white/20 bg-transparent px-6 font-semibold hover:bg-white/5"
                    >
                      <Link to="/auth">
                        Levar para minha comunidade
                        <ArrowRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatCard value="+4×" label="Retenção mensal dos alunos" tone="lime" />
                  <StatCard value="R$0" label="Custo pra começar" />
                  <StatCard value="300" label="Alunos por desafio PRO" />
                  <StatCard value="24/7" label="Feed e chat da comunidade" tone="lime" />
                </div>
              </div>
            </div>
          </RevealSection>

          {/* CTA FINAL */}
          <RevealSection className="mt-28 lg:mt-36">
            <div
              className="relative overflow-hidden rounded-[2rem] border border-primary/40 p-8 text-center sm:p-14 lg:p-20"
              style={{
                background:
                  "linear-gradient(135deg, #1A0A05 0%, #0D0D0F 55%, #0D0D0F 100%)",
                boxShadow: "0 40px 100px -30px #FF5A1F55",
              }}
            >
              <div className="absolute -right-24 -top-24 size-96 rounded-full bg-primary/25 blur-3xl" />
              <div
                className="absolute -bottom-24 -left-24 size-80 rounded-full blur-3xl"
                style={{ background: `${LIME}22` }}
              />
              <div className="relative mx-auto max-w-3xl">
                <Kicker>Bora?</Kicker>
                <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                  Você já tem o treino.{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, #FF9A3C, #FF5A1F, #E11D00)",
                    }}
                  >
                    Agora precisa da Crew.
                  </span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                  Crie seu grupo e descubra quem vai chegar ao topo.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-md bg-primary px-8 py-6 text-base font-bold text-primary-foreground shadow-[0_10px_40px_-10px_#FF5A1F] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FF6A2F]"
                  >
                    <Link to={CREATE_HREF}>
                      🔥 CRIAR MINHA CREW GRÁTIS
                    </Link>
                  </Button>
                </div>
                <p className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" style={{ color: LIME }} />
                    Grátis para começar
                  </span>
                  <span className="text-white/25">·</span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" style={{ color: LIME }} />
                    Sem cartão
                  </span>
                  <span className="text-white/25">·</span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" style={{ color: LIME }} />
                    Crie em 1 minuto
                  </span>
                </p>
              </div>
            </div>
          </RevealSection>
        </main>

        {/* Sticky CTA mobile */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <Button
            asChild
            size="lg"
            className="w-full rounded-md bg-primary font-bold text-primary-foreground shadow-[0_10px_30px_-10px_#FF5A1F]"
          >
            <Link to={CREATE_HREF}>
              🔥 CRIAR MINHA CREW GRÁTIS
              <Zap className="ml-1 size-4" />
            </Link>
          </Button>
        </div>

        {/* FOOTER */}
        <footer className="border-t border-border py-10 pb-28 text-center text-xs text-muted-foreground lg:pb-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <FitCrewLogo size={22} />
              <span className="font-display text-sm font-extrabold tracking-tight text-foreground">
                FitCrew
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <Link to="/sobre" className="transition hover:text-foreground">
                Sobre nós
              </Link>
              <Link to="/privacidade" className="transition hover:text-foreground">
                Privacidade
              </Link>
            </div>
            <p className="mt-2 text-xs">Feito pra suar entre amigos.</p>
          </div>
        </footer>

        {joinOpen && <JoinCrewModal onClose={() => setJoinOpen(false)} />}
      </div>
    </div>
  );
}

/* =========================================================================
   Modal — Entrar em uma Crew
   ========================================================================= */

function JoinCrewModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 3) return;
    navigate({ to: "/auth", search: { join: clean } });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-[1.5rem] border border-border bg-card p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            "linear-gradient(160deg, #17171D 0%, #101014 100%)",
          boxShadow: "0 40px 100px -20px #000, 0 0 0 1px #2A2A35 inset",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-border bg-black/40 text-muted-foreground transition hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>

        <Kicker tone="lime">Entrar em uma Crew</Kicker>
        <h3 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
          Tem um código de convite?
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Cole o código que sua crew enviou. Se não tiver, você também pode explorar
          desafios públicos.
        </p>

        <form onSubmit={submit} className="mt-5 grid gap-3">
          <Input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: FIT-2A3B"
            className="h-12 rounded-md border-border bg-background/60 text-center font-display text-base font-bold tracking-[0.2em] text-foreground placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/70"
            maxLength={16}
          />
          <Button
            type="submit"
            size="lg"
            disabled={code.trim().length < 3}
            className="rounded-md bg-primary font-bold text-primary-foreground hover:bg-[#FF6A2F] disabled:opacity-40"
          >
            Entrar na Crew
            <ArrowRight className="ml-1 size-4" />
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          asChild
          variant="ghost"
          className="w-full rounded-md border border-white/15 bg-transparent font-semibold hover:bg-white/5"
        >
          <Link to="/auth">Explorar desafios públicos</Link>
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================
   Building blocks
   ========================================================================= */

function NoiseBackdrop() {
  const noise =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.05] mix-blend-overlay"
      style={{ backgroundImage: `url("${noise}")` }}
    />
  );
}

function Kicker({
  children,
  tone = "orange",
}: {
  children: React.ReactNode;
  tone?: "orange" | "lime";
}) {
  const color = tone === "lime" ? LIME : "#FF5A1F";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em]"
      style={{
        borderColor: `${color}44`,
        background: `${color}0F`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function SectionHead({
  kicker,
  kickerTone = "orange",
  children,
  sub,
}: {
  kicker: string;
  kickerTone?: "orange" | "lime";
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Kicker tone={kickerTone}>{kicker}</Kicker>
      <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]">
        {children}
      </h2>
      {sub && (
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

function RevealSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`animate-fade-in ${className ?? ""}`}>{children}</section>;
}

/* ---------- Hero mockup: Ranking ---------- */

function HeroMockup() {
  return (
    <div
      className="relative rounded-[2rem] border border-border p-4 shadow-2xl sm:p-5"
      style={{
        background: "linear-gradient(160deg, #14141A 0%, #0D0D0F 100%)",
        boxShadow: "0 40px 80px -20px #000, 0 0 0 1px #2A2A35 inset",
      }}
    >
      <div className="flex items-center justify-between px-1 pb-4">
        <div className="flex items-center gap-2">
          <FitCrewLogo size={26} />
          <span className="font-display text-sm font-extrabold tracking-tight">FitCrew</span>
        </div>
        <LiveBadge />
      </div>

      <div className="rounded-2xl border border-border bg-[#0D0D0F] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Ranking · semana 3
            </p>
            <p className="mt-1 font-display text-lg font-extrabold">Crew do Suor</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold" style={{ color: LIME }}>
              +14%
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              vs. anterior
            </p>
          </div>
        </div>

        <ol className="mt-4 grid gap-2">
          <RankRow pos={1} name="Rafa" pts={480} streak={14} highlight />
          <RankRow pos={2} name="Ana" pts={445} streak={9} />
          <RankRow pos={3} name="Você" pts={412} streak={7} you />
        </ol>

        <div
          className="mt-4 flex items-center gap-3 rounded-xl border p-3"
          style={{ borderColor: `${LIME}55`, background: `${LIME}10` }}
        >
          <div
            className="grid size-9 shrink-0 place-items-center rounded-lg"
            style={{ background: `${LIME}22`, color: LIME }}
          >
            <Trophy className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              Faltam <span style={{ color: LIME }}>33 pontos</span> para ultrapassar a Ana.
            </p>
            <p className="text-xs text-muted-foreground">
              1 treino de força hoje resolve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{
        borderColor: `${LIME}55`,
        background: `${LIME}12`,
        color: LIME,
      }}
    >
      <span className="relative flex size-1.5">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ background: LIME }}
        />
        <span
          className="relative inline-flex size-1.5 rounded-full"
          style={{ background: LIME }}
        />
      </span>
      ao vivo
    </span>
  );
}

function RankRow({
  pos,
  name,
  pts,
  streak,
  highlight,
  you,
}: {
  pos: number;
  name: string;
  pts: number;
  streak: number;
  highlight?: boolean;
  you?: boolean;
}) {
  return (
    <li
      className="flex items-center gap-3 rounded-xl border p-2.5"
      style={{
        borderColor: highlight ? "#FF5A1F55" : you ? `${LIME}55` : "#2A2A35",
        background: highlight ? "#FF5A1F14" : you ? `${LIME}0F` : "#14141A",
      }}
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-lg font-display text-sm font-extrabold text-white"
        style={{
          background: highlight
            ? "linear-gradient(135deg,#FF9A3C,#FF5A1F)"
            : "#2A2A35",
          boxShadow: highlight ? "0 6px 20px -6px #FF5A1F" : undefined,
        }}
      >
        {pos}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold">
          {name}
          {you && (
            <span
              className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ background: `${LIME}22`, color: LIME }}
            >
              você
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground">
          🔥 streak <span className="font-bold text-foreground">{streak}d</span>
        </p>
      </div>
      <div className="text-right">
        <p className="font-display text-base font-extrabold tabular-nums">
          {pts}
        </p>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground">pts</p>
      </div>
    </li>
  );
}

/* ---------- Problem cards ---------- */

function ProblemCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-6 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 sm:text-left">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-white/5 text-muted-foreground transition-transform duration-200 group-hover:scale-105 sm:mx-0">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

/* ---------- Bento grid ---------- */

function BentoCard({
  icon,
  emoji,
  title,
  text,
  children,
  className,
  tone = "primary",
}: {
  icon: React.ReactNode;
  emoji?: string;
  title: string;
  text: string;
  children?: React.ReactNode;
  className?: string;
  tone?: "primary" | "lime";
}) {
  const color = tone === "lime" ? LIME : "#FF5A1F";
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 sm:p-7 ${className ?? ""}`}
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 60%), #141419",
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full opacity-40 blur-3xl transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: `${color}55` }}
      />
      <div className="relative flex items-start gap-4">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
          style={{
            background:
              tone === "lime"
                ? `linear-gradient(135deg, ${LIME}, #7FCC1F)`
                : "linear-gradient(135deg, #FF9A3C, #FF5A1F, #E11D00)",
            color: tone === "lime" ? "#0D0D0F" : "#fff",
            boxShadow: `0 10px 24px -10px ${color}`,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            {emoji} {title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {text}
          </p>
        </div>
      </div>
      {children && <div className="relative mt-5">{children}</div>}
    </div>
  );
}

function MiniRanking() {
  return (
    <div className="grid gap-2">
      <RankRow pos={1} name="Rafa" pts={480} streak={14} highlight />
      <RankRow pos={2} name="Ana" pts={445} streak={9} />
      <RankRow pos={3} name="Você" pts={412} streak={7} you />
    </div>
  );
}

function StreakVisual() {
  const days = [true, true, true, true, true, true, true, false];
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-extrabold" style={{ color: LIME }}>
          14
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          dias seguidos
        </span>
      </div>
      <div className="mt-3 flex gap-1.5">
        {days.map((on, i) => (
          <div
            key={i}
            className="grid h-8 flex-1 place-items-center rounded-md text-xs font-bold"
            style={{
              background: on ? `${LIME}22` : "#1F1F26",
              border: `1px solid ${on ? `${LIME}55` : "#2A2A35"}`,
              color: on ? LIME : "#4A4A55",
            }}
          >
            {on ? "🔥" : "·"}
          </div>
        ))}
      </div>
    </div>
  );
}

function IAVisual() {
  return (
    <div className="grid gap-2 text-xs">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-black/30 p-2.5">
        <div
          className="grid size-6 shrink-0 place-items-center rounded-md text-[10px]"
          style={{ background: `${LIME}22`, color: LIME }}
        >
          ✓
        </div>
        <span className="text-muted-foreground">
          <span className="font-bold text-foreground">Treino aprovado</span> — foto na academia detectada.
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-black/30 p-2.5">
        <div
          className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/25 text-[10px] text-primary"
        >
          ⚠
        </div>
        <span className="text-muted-foreground">
          <span className="font-bold text-foreground">Suspeito.</span> Foto sem contexto de treino.
        </span>
      </div>
    </div>
  );
}

function DuelsVisual() {
  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl border border-border bg-black/30 p-4"
    >
      <DuelSide name="Você" pts={412} tone="lime" />
      <div className="grid place-items-center">
        <span className="font-display text-2xl font-extrabold text-muted-foreground">
          VS
        </span>
        <span
          className="mt-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ background: "#FF5A1F22", color: "#FF5A1F" }}
        >
          Aposta: 3 pts
        </span>
      </div>
      <DuelSide name="Rafa" pts={480} tone="primary" align="right" />
    </div>
  );
}

function DuelSide({
  name,
  pts,
  tone,
  align = "left",
}: {
  name: string;
  pts: number;
  tone: "primary" | "lime";
  align?: "left" | "right";
}) {
  const color = tone === "lime" ? LIME : "#FF5A1F";
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className={`inline-flex size-10 items-center justify-center rounded-full font-display text-sm font-extrabold text-white`}
        style={{
          background:
            tone === "lime"
              ? `linear-gradient(135deg,${LIME},#7FCC1F)`
              : "linear-gradient(135deg,#FF9A3C,#FF5A1F,#E11D00)",
          color: tone === "lime" ? "#0D0D0F" : "#fff",
        }}
      >
        {name[0]}
      </div>
      <p className="mt-1.5 font-display text-sm font-bold">{name}</p>
      <p className="text-[11px] font-bold tabular-nums" style={{ color }}>
        {pts} pts
      </p>
    </div>
  );
}

/* ---------- Timeline ---------- */

function TimelineStep({
  n,
  icon,
  title,
  text,
  last,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  text: string;
  last?: boolean;
}) {
  return (
    <li className="group relative rounded-2xl border border-border bg-card p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 sm:text-left">
      {!last && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-primary/50 to-transparent lg:block"
        />
      )}
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-white/5 text-foreground transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
          {icon}
          <span
            className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-[10px] font-extrabold text-black"
            style={{ background: LIME }}
          >
            {n}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-bold">{title}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </li>
  );
}

/* ---------- Stat card (B2B) ---------- */

function StatCard({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "lime";
}) {
  const color = tone === "lime" ? LIME : "#FF5A1F";
  return (
    <div
      className="rounded-2xl border border-border p-5"
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.02), rgba(0,0,0,0)) , #141419",
      }}
    >
      <p
        className="font-display text-3xl font-extrabold tabular-nums sm:text-4xl"
        style={{ color }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

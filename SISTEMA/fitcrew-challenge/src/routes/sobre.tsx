import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Flame,
  Trophy,
  Users,
  Dumbbell,
  Camera,
  Sparkles,
  TrendingUp,
  Heart,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FitCrewLogo } from "@/components/brand/fitcrew-logo";

export const Route = createFileRoute("/sobre")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "Sobre nós — FitCrew" },
      {
        name: "description",
        content:
          "Conheça a FitCrew: a plataforma que transforma treino em desafio entre amigos. Gamificação, foto do dia, ranking e temporadas.",
      },
      { property: "og:title", content: "Sobre nós — FitCrew" },
      {
        property: "og:description",
        content:
          "Conheça a FitCrew: a plataforma que transforma treino em desafio entre amigos.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/sobre" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/sobre" }],
  }),

});

const values = [
  {
    icon: Heart,
    title: "Comunidade primeiro",
    text: "Treinar sozinho cansa. Treinar em crew dura. A gente acredita que o próximo nível da saúde vem da pressão positiva do grupo.",
  },
  {
    icon: Target,
    title: "Foco no resultado real",
    text: "Sem enganação. 30 minutos de treino, 5 dias por semana, consistência medida em pontos, fotos e streaks.",
  },
  {
    icon: Zap,
    title: "Gamificação com propósito",
    text: "Cada check-in conta. Ranking, temporadas e conquistas servem para manter o fogo aceso, não para humilhar ninguém.",
  },
];

const flow = [
  { icon: Dumbbell, title: "Registre o treino", desc: "Bateu o ponto? Marca no app em segundos." },
  { icon: Camera, title: "Manda a foto", desc: "Prova social para a crew, motivação para você." },
  { icon: Sparkles, title: "Ganha pontos", desc: "Cada atividade tem peso no placar da temporada." },
  { icon: Trophy, title: "Disputa o topo", desc: "Ranking ao vivo mostra quem está mais consistente." },
  { icon: TrendingUp, title: "Mantém o streak", desc: "Sequências de dias geram bônus e bragging rights." },
];

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
        <Link to="/" className="flex items-center gap-2">
          <FitCrewLogo size={32} />
          <span className="font-display text-xl font-bold tracking-tight">FitCrew</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full shadow-flame">
            <Link to="/auth">Começar</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 md:pt-14 lg:pt-20">
        {/* Hero */}
        <section className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Nossa missão
          </span>
          <h1 className="mx-auto mt-5 max-w-4xl font-display text-[2.5rem] font-black leading-[0.95] tracking-tight sm:text-6xl">
            Transformar treino em{" "}
            <span className="bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
              conexão e resultado
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A FitCrew nasceu da vontade de fazer academia parar de ser uma guerra solitária. Aqui,
            você não compete com o mundo: você compete com a versão de ontem, ao lado de quem
            torce pelo seu progresso.
          </p>
        </section>

        {/* Why */}
        <section className="mt-20 lg:mt-28">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                O problema que a gente resolve
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Motivação some. Crew não deixa.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Todo mundo já começou uma rotina fitness e abandonou depois de duas semanas. A
                falta de accountability, a competição tóxica das redes sociais e a falta de
                progresso claro são os maiores vilões. A FitCrew troca isso por desafios fechados
                entre amigos, pontos objetivos e uma foto do dia que prova: você apareceu.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full shadow-flame transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Link to="/auth">Criar minha crew</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full transition-colors hover:bg-muted"
                >
                  <Link to="/">Voltar para home</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-flame">
                  <Users className="size-5" />
                </div>
                <p className="mt-4 font-display text-2xl font-black">5-20</p>
                <p className="text-sm text-muted-foreground">pessoas por crew ideal</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-flame">
                  <Dumbbell className="size-5" />
                </div>
                <p className="mt-4 font-display text-2xl font-black">30min</p>
                <p className="text-sm text-muted-foreground">de treino mínimo por sessão</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:col-span-2">
                <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-flame">
                  <Trophy className="size-5" />
                </div>
                <p className="mt-4 font-display text-2xl font-black">Temporadas</p>
                <p className="text-sm text-muted-foreground">
                  Cada temporada tem início, fim e recompensa. Quem termina forte começa a próxima
                  ainda mais forte.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="mt-20 lg:mt-28">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              O que move a gente
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Três pilares da FitCrew
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-flame">
                  <value.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Flow */}
        <section className="mt-20 lg:mt-28">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Como funciona
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              A jornada do atleta
            </h2>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {flow.map((step, i) => (
              <li
                key={step.title}
                className="group relative flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <step.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Passo {i + 1}
                  </p>
                  <p className="font-display text-sm font-bold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="mt-20 lg:mt-28">
          <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-12 text-background sm:px-10 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,oklch(0.685_0.19_40/0.35),transparent_50%)]" />
            <div className="relative mx-auto max-w-2xl text-center">
              <h2 className="font-display text-2xl font-bold sm:text-4xl">
                Bora montar sua crew?
              </h2>
              <p className="mt-3 text-sm text-background/80 sm:text-base">
                Entre, chame os amigos e comece a primeira temporada. Quem chega primeiro define
                as regras.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-primary text-primary-foreground shadow-flame transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <Link to="/auth">Criar conta grátis</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-background/20 bg-background/10 text-background hover:bg-background/20 hover:text-background"
                >
                  <Link to="/">Explorar app</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-4 sm:px-6">
          <Link to="/" className="transition hover:text-foreground">
            Home
          </Link>
          <Link to="/sobre" className="transition hover:text-foreground">
            Sobre nós
          </Link>
          <Link to="/privacidade" className="transition hover:text-foreground">
            Privacidade
          </Link>
          <Link to="/auth" className="transition hover:text-foreground">
            Entrar
          </Link>
        </div>
        <p className="mt-4">Feito pra suar entre amigos.</p>
      </footer>
    </div>
  );
}

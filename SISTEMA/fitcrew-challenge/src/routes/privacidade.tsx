import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Mail, Cookie, Lock, Eye, Trash2, UserCog, Clock, Flame, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FitCrewLogo } from "@/components/brand/fitcrew-logo";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — FitCrew" },
      {
        name: "description",
        content:
          "Saiba como a FitCrew coleta, usa e protege seus dados. Direitos, retenção, cookies e contato.",
      },
      { property: "og:title", content: "Política de Privacidade — FitCrew" },
      {
        property: "og:description",
        content:
          "Saiba como a FitCrew coleta, usa e protege seus dados. Direitos, retenção, cookies e contato.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/privacidade" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/privacidade" }],
  }),

});

const sections = [
  {
    id: "intro",
    icon: Shield,
    title: "1. O que é esta política",
    content: [
      "Esta página é mantida pela FitCrew para explicar, de forma clara, como lidamos com os dados dos atletas que usam a plataforma.",
      "A FitCrew é um aplicativo de desafios fitness entre amigos. Para funcionar, precisamos de algumas informações pessoais — e levamos isso a sério.",
      "Ao usar o app, você concorda com as práticas descritas aqui. Se não concordar, pode deixar de usar a plataforma ou solicitar a exclusão da conta a qualquer momento.",
    ],
  },
  {
    id: "coleta",
    icon: UserCog,
    title: "2. Dados que coletamos",
    content: [
      "Dados de cadastro: nome, e-mail, foto de perfil e nome de usuário. São necessários para criar sua conta e identificar você dentro da crew.",
      "Dados de uso: check-ins de treino, fotos do dia, pontos, rankings, streaks, peso e medidas corporais (quando você optar por registrar).",
      "Dados técnicos: endereço IP, tipo de navegador, identificador do dispositivo e cookies essenciais para autenticação e segurança.",
      "Não vendemos dados pessoais a terceiros. Nunca.",
    ],
  },
  {
    id: "uso",
    icon: Eye,
    title: "3. Como usamos seus dados",
    content: [
      "Para operar o app: exibir feed, ranking, temporadas, desafios e permitir que você e seus amigos acompanhem a evolução.",
      "Para gamificação: calcular pontos, streaks, conquistas e posições no leaderboard da sua crew.",
      "Para comunicação: enviar notificações sobre atividade da crew, lembretes de treino e atualizações importantes do serviço.",
      "Para segurança: detectar abuso, spam, tentativas de fraude e manter a integridade das competições.",
    ],
  },
  {
    id: "compartilhamento",
    icon: Server,
    title: "4. Com quem compartilhamos",
    content: [
      "Com sua crew: os dados de check-ins, fotos do dia, pontos e ranking são visíveis dentro do grupo privado ao qual você pertence. Apenas membros convidados têm acesso.",
      "Com provedores de infraestrutura: usamos serviços de nuvem e autenticação para hospedar o app e proteger login. Esses parceiros só processam dados sob nossas instruções e contratos de confidencialidade.",
      "Com autoridades: somente se exigido por lei, ordem judicial ou para proteger nossos direitos e a segurança dos usuários.",
    ],
  },
  {
    id: "retencao",
    icon: Clock,
    title: "5. Retenção e exclusão",
    content: [
      "Mantemos seus dados enquanto sua conta estiver ativa. Isso permite que você acesse histórico, evolução e conquistas.",
      "Você pode excluir sua conta a qualquer momento na tela de configurações. Ao confirmar, removemos dados pessoais identificáveis e desvinculamos conteúdo publicado de sua identidade.",
      "Alguns registros podem permanecer por mais tempo quando necessário para cumprir obrigações legais, resolver disputas ou garantir segurança.",
    ],
  },
  {
    id: "direitos",
    icon: Lock,
    title: "6. Seus direitos",
    content: [
      "Acessar seus dados: você pode consultar as informações que temos sobre você na tela de perfil e configurações.",
      "Corrigir: nome, foto e medidas podem ser atualizados diretamente no app.",
      "Excluir: solicite a remoção da conta e dos dados pessoais a qualquer momento.",
      "Revogar consentimento: para notificações e integrações opcionais, basta ajustar nas configurações.",
    ],
  },
  {
    id: "cookies",
    icon: Cookie,
    title: "7. Cookies e tecnologias similares",
    content: [
      "Usamos cookies essenciais para manter sua sessão ativa e proteger contra acesso não autorizado.",
      "Cookies analíticos podem ser usados para entender como o app é utilizado e melhorar a experiência, sempre respeitando as configições do navegador.",
      "Você pode limpar cookies pelo navegador; isso pode desconectar sua conta, mas não impede o uso do app.",
    ],
  },
  {
    id: "seguranca",
    icon: Trash2,
    title: "8. Segurança",
    content: [
      "Aplicamos autenticação segura, comunicação criptografada (HTTPS) e controle de acesso baseado em permissões.",
      "Fotos do dia e dados de check-ins são armazenados em serviços de nuvem com criptografia em trânsito e em repouso.",
      "Nenhum sistema é 100% invulnerável. Se identificarmos um incidente de segurança que afete seus dados, notificaremos os usuários conforme exigido pela legislação aplicável.",
    ],
  },
];

function PrivacyPage() {
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

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6 md:pt-14 lg:pt-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <Shield className="size-3.5" />
            Privacidade
          </span>
          <h1 className="mt-5 font-display text-[2.5rem] font-black leading-[0.95] tracking-tight sm:text-5xl">
            Política de Privacidade
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id}>
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <section.icon className="size-4.5" />
                </div>
                <h2 className="font-display text-xl font-bold tracking-tight">{section.title}</h2>
              </div>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {section.content.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          {/* Contact */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-flame">
                <Mail className="size-4.5" />
              </div>
              <h2 className="font-display text-xl font-bold tracking-tight">9. Contato</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Dúvidas, solicitações ou reportes sobre privacidade? Envie um e-mail para{" "}
              <a
                href="mailto:privacidade@fitcrew.app"
                className="font-medium text-primary underline underline-offset-4 transition hover:text-primary/80"
              >
                privacidade@fitcrew.app
              </a>
              . Responderemos o mais rápido possível.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="rounded-full shadow-flame transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <Link to="/auth">Criar conta</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full transition-colors hover:bg-muted"
          >
            <Link to="/sobre">Sobre nós</Link>
          </Button>
        </div>
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

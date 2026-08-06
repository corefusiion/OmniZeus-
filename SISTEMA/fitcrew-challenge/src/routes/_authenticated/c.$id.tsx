import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Crown, LayoutGrid, LineChart, MessageCircle, Plus, Settings, Swords, Trophy } from "lucide-react";
import { getChallengeHub } from "@/lib/challenge-hub.functions";

export const Route = createFileRoute("/_authenticated/c/$id")({
  component: ChallengeLayout,
});

function ChallengeLayout() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hubFn = useServerFn(getChallengeHub);
  const { data: hub } = useQuery({
    queryKey: ["challenge-hub", id],
    queryFn: () => hubFn({ data: { challengeId: id } }),
  });
  const role = hub?.role;
  const canEdit = role === "owner" || role === "co_admin" || role === "super_admin";
  const isMember = !!role;

  const tabs = [
    { to: "/c/$id", label: "Detalhes", icon: LayoutGrid, exact: true, show: true },
    { to: "/c/$id/ranking", label: "Classificações", icon: Trophy, exact: false, show: true },
    { to: "/c/$id/progress", label: "Progresso", icon: LineChart, exact: false, show: true },
    { to: "/c/$id/vs", label: "VS", icon: Swords, exact: false, show: true },
    { to: "/c/$id/duels", label: "Duelos", icon: Swords, exact: false, show: isMember },
    { to: "/c/$id/podium", label: "Pódio", icon: Crown, exact: false, show: true },
    { to: "/c/$id/chat", label: "Bate-papo", icon: MessageCircle, exact: false, show: true },
    { to: "/c/$id/history", label: "Meu histórico", icon: ClipboardList, exact: false, show: isMember },
    { to: "/c/$id/settings", label: canEdit ? "Configurações" : "Participantes", icon: Settings, exact: false, show: canEdit || isMember },
  ] as const;


  const isActive = (to: string, exact: boolean) => {
    const full = to.replace("$id", id);
    return exact ? pathname === full : pathname === full || pathname.startsWith(full + "/");
  };

  return (
    <div className="relative">
      <div className="sticky top-14 z-30 -mx-3 mb-4 border-b border-border bg-background/95 px-3 backdrop-blur-xl sm:-mx-4 sm:px-4 lg:top-0 lg:mx-0 lg:rounded-2xl lg:border lg:bg-card lg:px-2 lg:shadow-soft">
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {tabs.filter((t) => t.show).map((t) => {
            const Icon = t.icon;
            const active = isActive(t.to, t.exact);
            return (
              <Link
                key={t.to}
                to={t.to}
                params={{ id }}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-flame"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <Outlet />

      <Link
        to="/checkin"
        aria-label="Registrar check-in"
        className="fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-flame ring-4 ring-background transition-transform hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus className="size-6" />
      </Link>
    </div>
  );
}

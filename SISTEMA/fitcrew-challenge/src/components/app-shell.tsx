import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bot,
  Coins,
  Compass,
  Crown,
  Flag,
  Home,
  LogOut,
  Menu,
  Plus,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";
import { FitCrewLogo } from "@/components/brand/fitcrew-logo";

import type { ReactNode } from "react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { RightRail } from "@/components/right-rail";
import { UsernameOnboarding } from "@/components/username-onboarding";
import { ChatLauncher } from "@/components/feed/chat-launcher";

type NavItem = {
  to: "/feed" | "/checkin" | "/ranking" | "/settings" | "/chatfit";
  label: string;
  icon: typeof Home;
};

const bottomNav: readonly NavItem[] = [
  { to: "/feed", label: "Feed", icon: Home },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/chatfit", label: "Chat Fit", icon: Bot },
  { to: "/checkin", label: "Ponto", icon: Plus },
  { to: "/settings", label: "Ajustes", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: me, isSuccess: meLoaded } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const [profileRes, rolesRes, ownedRes, memberRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userData.user.id),
        supabase.from("challenges").select("id", { count: "exact", head: true }).eq("owner_id", userData.user.id),
        supabase.from("challenge_members").select("challenge_id, challenges!inner(is_active)", { count: "exact", head: false }).eq("user_id", userData.user.id).eq("challenges.is_active", true),
      ]);
      if (profileRes.error) {
        console.error("[me] profile fetch error", profileRes.error);
        throw profileRes.error;
      }
      const roles = (rolesRes.data ?? []).map((r) => r.role as string);
      const isSuperAdmin = roles.includes("super_admin");
      const isLegacyAdmin = roles.includes("admin");
      const ownedChallenges = ownedRes.count ?? 0;
      const activeMemberships = (memberRes.data ?? []).length;
      return {
        userId: userData.user.id,
        email: userData.user.email,
        profile: profileRes.data as any,
        roles,
        isSuperAdmin,
        isChallengeOwner: ownedChallenges > 0,
        // "Admin" menu: super_admin OU dono de pelo menos 1 desafio.
        canSeeAdmin: isSuperAdmin || ownedChallenges > 0,
        // Compat com código legado que ainda lê isAdmin
        isAdmin: isSuperAdmin || isLegacyAdmin,
        hasActiveChallenge: activeMemberships > 0 || ownedChallenges > 0,
      };
    },
    retry: 1,
    // Sempre revalidar — evita que uma versão antiga do profile (sem username)
    // fique em cache e reabra o modal de onboarding após novo login.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (me?.profile?.display_name ?? me?.email ?? "?").slice(0, 2).toUpperCase();

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  // Só solicita @username quando o profile foi carregado E o campo está
  // realmente vazio (null / string vazia). Qualquer valor truthy fecha o modal.
  const profileHasUsernameField =
    !!me?.profile && Object.prototype.hasOwnProperty.call(me.profile, "username");
  const currentUsername = profileHasUsernameField ? me.profile.username : null;
  const hasUsername =
    typeof currentUsername === "string" && currentUsername.trim().length > 0;
  const needsUsername = meLoaded && !!me?.userId && me?.profile != null && profileHasUsernameField && !hasUsername;
  // Solicita métricas iniciais quando o usuário nunca preencheu peso E nunca marcou como pulado
  const needsMetrics =
    meLoaded &&
    !!me?.userId &&
    me?.profile != null &&
    me.profile.weight_kg == null &&
    me.profile.metrics_updated_at == null;
  const onboardingOpen = needsUsername || needsMetrics;

  return (
    <div className="min-h-screen bg-background pb-20 lg:h-screen lg:min-h-0 lg:overflow-hidden lg:pb-0">
      <UsernameOnboarding
        open={onboardingOpen}
        displayName={me?.profile?.display_name ?? me?.email}
        needsUsername={needsUsername}
        needsMetrics={needsMetrics}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["me"] })}
      />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border p-4">
              <SheetTitle className="flex items-center gap-2">
                <FitCrewLogo size={28} />
                FitCrew

              </SheetTitle>
            </SheetHeader>
            <SidebarBody
              me={me}
              isActive={isActive}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={handleSignOut}
            />
          </SheetContent>
        </Sheet>
        <Link to="/feed" className="flex items-center gap-2">
          <FitCrewLogo size={28} />
          <span className="font-display text-lg font-bold">FitCrew</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />

          {me?.userId && (
            <Link to="/profile/$userId" params={{ userId: me.userId }} className="relative">
              <Avatar className={`size-9 border ${me?.profile?.is_pro ? "border-amber-400 ring-2 ring-amber-400/40" : "border-border"}`}>
                <AvatarImage src={me?.profile?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {me?.profile?.is_pro && (
                <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-amber-500 text-white shadow ring-2 ring-background">
                  <Crown className="size-2.5" />
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1760px] gap-6 px-3 py-4 sm:px-4 sm:py-6 lg:h-screen lg:px-6 lg:py-6 xl:gap-8 xl:px-8 2xl:max-w-[1920px]">
        <aside className="hidden w-64 shrink-0 flex-col rounded-3xl border border-border bg-card shadow-soft lg:flex lg:h-[calc(100vh-3rem)] xl:w-72">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <FitCrewLogo size={32} />
            <div>

              <p className="font-display text-lg font-bold leading-none">FitCrew</p>
              <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                Crew challenge
              </p>
            </div>
          </div>
          <SidebarBody me={me} isActive={isActive} onSignOut={handleSignOut} />
        </aside>

        <main className="min-w-0 flex-1 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1">{children}</main>

        <aside className="hidden w-80 shrink-0 xl:block xl:h-[calc(100vh-3rem)] xl:overflow-y-auto 2xl:w-[26rem]">
          <RightRail me={me} />
        </aside>
      </div>


      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end">
          {bottomNav.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            if (item.to === "/chatfit") {
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="relative -mt-6 flex flex-col items-center gap-1 py-2 text-[11px] font-semibold"
                >
                  <div
                    className={`grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-flame ring-4 ring-background transition-transform ${active ? "scale-105" : ""}`}
                  >
                    <Icon className="size-6" />
                  </div>
                  <span className={active ? "text-primary" : "text-foreground"}>
                    {item.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`grid size-9 place-items-center rounded-full transition-all ${
                    active ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <ChatLauncher />
    </div>
  );
}

function SidebarBody({
  me,
  isActive,
  onNavigate,
  onSignOut,
}: {
  me: any;
  isActive: (to: string) => boolean;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  const initials = (me?.profile?.display_name ?? me?.email ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {me?.userId && (
          <Link
            to="/profile/$userId"
            params={{ userId: me.userId }}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
              isActive("/profile")
                ? "bg-primary/10 text-primary"
                : "hover:bg-secondary"
            }`}
          >
            <div className="relative">
              <Avatar className={`size-9 border ${me?.profile?.is_pro ? "border-amber-400 ring-2 ring-amber-400/40" : "border-border"}`}>
                <AvatarImage src={me?.profile?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {me?.profile?.is_pro && (
                <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-amber-500 text-white shadow ring-2 ring-background">
                  <Crown className="size-2.5" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-display text-sm font-bold leading-tight">
                  {me?.profile?.display_name ?? "Meu perfil"}
                </p>
                {me?.profile?.is_pro && (
                  <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white">
                    PRO
                  </span>
                )}
              </div>
              {me?.profile?.is_pro && me?.profile?.pro_until ? (
                <p className="truncate text-[10px] text-muted-foreground">
                  Renova em {new Date(me.profile.pro_until).toLocaleDateString("pt-BR")}
                </p>
              ) : (
                <p className="truncate text-xs text-muted-foreground">Ver perfil</p>
              )}
            </div>
          </Link>
        )}

        <Link
          to="/store"
          onClick={onNavigate}
          className="mt-1 flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-xs font-medium text-amber-900 transition hover:from-amber-100 hover:to-orange-100 dark:from-amber-950/30 dark:to-orange-950/30 dark:text-amber-200"
        >
          <Coins className="size-4 text-amber-500" />
          <span className="font-display font-bold tabular-nums">
            {me?.profile?.fitcoins_balance ?? 0}
          </span>
          <span className="opacity-80">FitCoins</span>
          <span className="ml-auto text-[10px] uppercase tracking-wide opacity-70">Loja →</span>
        </Link>

        <div className="my-2 h-px bg-border" />

        <SidebarLink to="/feed" label="Feed" Icon={Home} active={isActive("/feed")} onNavigate={onNavigate} />
        <SidebarLink to="/checkin" label="Fazer check-in" Icon={Plus} active={isActive("/checkin")} primary onNavigate={onNavigate} />
        <SidebarLink to="/chatfit" label="Chat Fit" Icon={Bot} active={isActive("/chatfit")} onNavigate={onNavigate} badge="beta" />
        <SidebarLink to="/ranking" label="Ranking" Icon={Trophy} active={isActive("/ranking")} onNavigate={onNavigate} />
        <SidebarLink to="/challenges" label="Desafios" Icon={Flag} active={isActive("/challenges")} onNavigate={onNavigate} />
        <SidebarLink to="/explore" label="Explorar" Icon={Compass} active={isActive("/explore")} onNavigate={onNavigate} highlight={!me?.hasActiveChallenge} />
        <SidebarLink to="/store" label="FitPRO" Icon={Crown} active={isActive("/store")} onNavigate={onNavigate} badge={me?.profile?.is_pro ? "PRO" : "novo"} />
        <SidebarLink to="/settings" label="Configurações" Icon={Settings} active={isActive("/settings")} onNavigate={onNavigate} />
        {me?.canSeeAdmin && (
          <SidebarLink to="/admin" label="Admin" Icon={Shield} active={isActive("/admin")} onNavigate={onNavigate} />
        )}
        {me?.isSuperAdmin && (
          <>
            <SidebarLink
              to="/admin/warnings"
              label="Trust & Safety"
              Icon={ShieldAlert}
              active={isActive("/admin/warnings")}
              onNavigate={onNavigate}
            />
            <SidebarLink
              to="/admin/moderation"
              label="Moderação IA"
              Icon={Bot}
              active={isActive("/admin/moderation")}
              onNavigate={onNavigate}
            />
          </>
        )}

        <div className="my-2 h-px bg-border" />

        <SidebarLink
          to="/notifications"
          label="Notificações"
          Icon={Bell}
          active={isActive("/notifications")}
          onNavigate={onNavigate}
        />

        <button
          onClick={() => {
            onNavigate?.();
            onSignOut();
          }}
          className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-destructive/10 hover:text-destructive lg:hidden"
        >
          <LogOut className="size-4" />
          Sair do sistema
        </button>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <button
            onClick={onSignOut}
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground lg:inline-flex"
          >
            <LogOut className="size-4" /> Sair
          </button>
        </div>
      </div>

    </div>
  );
}

function SidebarLink({
  to,
  label,
  Icon,
  active,
  primary,
  badge,
  highlight,
  onNavigate,
}: {
  to: NavItem["to"] | "/admin" | "/admin/warnings" | "/admin/moderation" | "/notifications" | "/challenges" | "/explore" | "/store";
  label: string;
  Icon: typeof Home;
  active: boolean;
  primary?: boolean;
  badge?: string;
  highlight?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? primary
            ? "bg-primary text-primary-foreground shadow-flame"
            : "bg-primary/10 text-primary"
          : highlight
            ? "bg-orange-500/10 text-orange-600 ring-1 ring-orange-500/30 hover:bg-orange-500/15 dark:text-orange-400"
            : "text-foreground hover:bg-secondary"
      }`}
    >
      <Icon className={`size-4 transition-transform group-hover:-translate-y-0.5 ${active && primary ? "text-primary-foreground" : ""}`} />
      {label}
      {highlight && !badge && (
        <span className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Comece aqui
        </span>
      )}
      {badge && (
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          {badge}
        </span>
      )}
      {primary && !active && !badge && !highlight && (
        <Sparkles className="ml-auto size-3.5 text-primary opacity-70" />
      )}
    </Link>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <h1 className="truncate font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
      <div className="mx-auto grid place-items-center">
        <FitCrewLogo size={48} />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>

      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

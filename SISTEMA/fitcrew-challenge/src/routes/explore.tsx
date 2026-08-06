import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Compass, Link2, Loader2, MapPin, Search, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { AppShell, SectionHeader } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { listPublicChallenges } from "@/lib/explore.functions";
import { joinChallengeAsSuperAdmin } from "@/lib/challenges.functions";
import { getChallengeStatus } from "@/lib/challenge-status";


export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explorar desafios — FitCrew" },
      {
        name: "description",
        content:
          "Descubra desafios públicos de academia e entre para treinar com uma nova galera. Ranking, foto do dia e evolução em grupo.",
      },
      { property: "og:title", content: "Explorar desafios — FitCrew" },
      {
        property: "og:description",
        content: "Descubra desafios públicos de academia e entre para treinar com uma nova galera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Nada por aqui.</div>
  ),
});

function ExplorePage() {
  const listFn = useServerFn(listPublicChallenges);
  const joinAsSuperFn = useServerFn(joinChallengeAsSuperAdmin);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [q, setQ] = useState("");

  const { data: authed, isLoading: authLoading } = useQuery({
    queryKey: ["explore-auth"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return !!data.user;
    },
    staleTime: 30_000,
  });

  const { data: isSuperAdmin } = useQuery({
    queryKey: ["explore-is-super-admin"],
    enabled: !!authed,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return false;
      const { data } = await (supabase as any).rpc("has_role", {
        _user_id: uid,
        _role: "super_admin",
      });
      return !!data;
    },
    staleTime: 60_000,
  });

  const joinAsSuperMut = useMutation({
    mutationFn: (challengeId: string) => joinAsSuperFn({ data: { challengeId } }),
    onSuccess: async (_res, challengeId) => {
      toast.success("Você entrou como Super Admin.");
      await queryClient.invalidateQueries({ queryKey: ["explore-public"] });
      router.navigate({ to: "/c/$id", params: { id: challengeId } });
    },
    onError: (err: any) => toast.error(err?.message ?? "Não foi possível entrar."),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["explore-public", q],
    queryFn: () => listFn({ data: { q: q || undefined, limit: 30 } }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const body = (
    <>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, descrição ou cidade…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nenhum desafio público encontrado.
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((c) => (
            <li key={c.id} className="min-w-0">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:border-primary/40">
                {c.banner_url && (
                  <div className="relative aspect-[16/6] w-full overflow-hidden bg-secondary">
                    <img
                      src={c.banner_url}
                      alt={`Capa do desafio ${c.name}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                    <h2 className="absolute bottom-3 left-4 right-4 truncate font-display text-2xl font-black text-white drop-shadow-md">
                      {c.name}
                    </h2>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      {!c.banner_url && (
                        <h2 className="truncate font-display text-lg font-bold">{c.name}</h2>
                      )}
                      {c.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {c.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {c.needs_first_human ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                            🔓 Seja o primeiro!
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3.5" />
                            {c.member_count} {c.member_count === 1 ? "membro" : "membros"}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <CalendarDays className="size-3.5" />
                          {getChallengeStatus(c.starts_at, c.ends_at).label}
                        </span>
                        {c.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {c.city}
                          </span>
                        )}
                      </div>
                      {c.owner && (
                        <div className="mt-3 flex items-center gap-2">
                          <Avatar className="size-6 border border-border">
                            <AvatarImage src={c.owner.avatar_url ?? undefined} />
                            <AvatarFallback>
                              {(c.owner.display_name ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-xs text-muted-foreground">
                            criado por <b className="text-foreground">{c.owner.display_name ?? "?"}</b>
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {c.invite_code && (
                        <>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const url = `${window.location.origin}/join/${c.invite_code}`;
                              try {
                                await navigator.clipboard.writeText(url);
                                toast.success("Link copiado! Cole no WhatsApp e convide a galera 🚀");
                              } catch {
                                toast.error("Não foi possível copiar o link.");
                              }
                            }}
                            aria-label="Compartilhar link do desafio"
                            className="grid size-10 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                          >
                            <Link2 className="size-4" />
                          </button>
                          <Link
                            to="/join/$code"
                            params={{ code: c.invite_code }}
                            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-flame hover:opacity-90"
                          >
                            Entrar
                          </Link>
                        </>
                      )}
                      {isSuperAdmin && (
                        <Link
                          to="/c/$id"
                          params={{ id: c.id }}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground shadow-sm hover:opacity-90"
                          aria-label="Visualizar como Super Admin"
                          title="Visualizar sem entrar no desafio (Super Admin)"
                        >
                          <Shield className="size-4" />
                          Visualizar
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}

        </ul>
      )}
    </>
  );

  if (authLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (authed) {
    return (
      <AppShell>
        <SectionHeader
          title="Explorar desafios"
          subtitle="Desafios abertos ao público. Entre no que combinar com você e comece a somar pontos."
        />
        {body}
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link to="/" className="font-display text-lg font-bold">
            FitCrew
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">
            <Link to="/auth" className="rounded-full border border-border px-3 py-1.5 font-semibold hover:bg-secondary">
              Entrar
            </Link>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
            <Compass className="size-7 text-primary" /> Explorar desafios
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Desafios abertos ao público. Entre no que combinar com você e comece a somar pontos.
          </p>
        </div>
        {body}
      </main>
    </div>
  );
}


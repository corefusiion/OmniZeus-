import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Crown, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { listHallOfFame } from "@/lib/podium.functions";

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall da Fama · Campeões dos desafios" },
      {
        name: "description",
        content: "Confira os vencedores dos desafios encerrados da comunidade.",
      },
      { property: "og:title", content: "Hall da Fama" },
      { property: "og:description", content: "Campeões dos desafios encerrados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HallOfFamePage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Página não encontrada.</div>
  ),
});

function HallOfFamePage() {
  const fetchHall = useServerFn(listHallOfFame);
  const { data, isLoading } = useQuery({
    queryKey: ["hall-of-fame"],
    queryFn: () => fetchHall(),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex items-center gap-3">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary shadow-flame">
          <Trophy className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Hall da Fama</h1>
          <p className="text-sm text-muted-foreground">Campeões dos desafios encerrados.</p>
        </div>
      </header>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <div className="space-y-3" role="status" aria-live="polite" aria-label="Carregando">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl border border-border bg-card" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-soft">
            Ainda não há desafios encerrados públicos.
          </div>
        ) : (
          data.map((h) => (
            <article
              key={h.challenge_id}
              className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-flame">
                <Crown className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg font-bold">{h.challenge_name}</h2>
                <p className="text-xs text-muted-foreground">
                  Encerrado em{" "}
                  {new Date(h.closed_at ?? h.ends_at).toLocaleDateString("pt-BR")}
                </p>
                {h.winner ? (
                  <Link
                    to="/profile/$userId"
                    params={{ userId: h.winner.user_id }}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <Avatar className="size-6">
                      <AvatarImage src={h.winner.avatar_url ?? undefined} />
                      <AvatarFallback>{h.winner.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {h.winner.display_name}
                  </Link>
                ) : (
                  <p className="mt-1 text-xs italic text-muted-foreground">Sem campeão registrado.</p>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Crown, Medal, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getChallengePodium } from "@/lib/podium.functions";

export const Route = createFileRoute("/_authenticated/c/$id/podium")({
  component: PodiumPage,
});

function PodiumPage() {
  const { id } = Route.useParams();
  const fetchPodium = useServerFn(getChallengePodium);
  const { data, isLoading } = useQuery({
    queryKey: ["podium", id],
    queryFn: () => fetchPodium({ data: { challengeId: id } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando pódio…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Sem dados.</p>;

  const { challenge, podium } = data;
  const closed = challenge.status === "closed";

  const orderMap = [1, 0, 2]; // display order: 2nd, 1st, 3rd
  const heights = ["h-32", "h-40", "h-24"];
  const colors = [
    "from-slate-300 to-slate-500",
    "from-amber-300 to-amber-500",
    "from-orange-400 to-orange-700",
  ];
  const medals = [<Medal key="s" className="size-6 text-slate-100" />, <Crown key="g" className="size-7 text-amber-100" />, <Medal key="b" className="size-6 text-orange-100" />];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Pódio
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold">{challenge.name}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(challenge.starts_at + "T00:00:00").toLocaleDateString("pt-BR")} →{" "}
              {new Date(challenge.ends_at + "T00:00:00").toLocaleDateString("pt-BR")}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              closed
                ? "bg-primary/10 text-primary"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Trophy className="size-3.5" />
            {closed ? "Encerrado" : "Prévia"}
          </span>
        </div>

        {podium.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum check-in registrado ainda.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-3 items-end gap-3">
            {orderMap.map((rankIdx) => {
              const entry = podium[rankIdx];
              if (!entry) return <div key={rankIdx} />;
              const initials = entry.display_name.slice(0, 2).toUpperCase();
              return (
                <div key={rankIdx} className="flex flex-col items-center gap-2">
                  <Link
                    to="/profile/$userId"
                    params={{ userId: entry.user_id }}
                    className="flex flex-col items-center gap-1"
                  >
                    <Avatar className="size-16 border-4 border-card shadow-soft">
                      <AvatarImage src={entry.avatar_url ?? undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <p className="max-w-full truncate text-center text-xs font-bold">
                      {entry.display_name}
                    </p>
                    <p className="text-[10px] tabular-nums text-muted-foreground">
                      {entry.total_points} pts
                    </p>
                  </Link>
                  <div
                    className={`w-full ${heights[rankIdx]} rounded-t-2xl bg-gradient-to-b ${colors[rankIdx]} grid place-items-start justify-center pt-2`}
                  >
                    <div className="flex flex-col items-center gap-1 text-white">
                      {medals[rankIdx]}
                      <span className="font-display text-2xl font-bold">{rankIdx + 1}º</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {podium.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
            {podium.map((p) => (
              <div key={p.user_id} className="rounded-2xl border border-border bg-secondary/40 p-3">
                <p className="font-display text-lg font-bold tabular-nums">{p.total_checkins}</p>
                <p className="text-muted-foreground">check-ins</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{p.total_minutes} min</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

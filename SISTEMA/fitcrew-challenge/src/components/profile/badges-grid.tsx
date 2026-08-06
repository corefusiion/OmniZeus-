import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listUserBadges } from "@/lib/badges.functions";

export function BadgesGrid({ userId }: { userId: string }) {
  const fetchBadges = useServerFn(listUserBadges);
  const { data, isLoading } = useQuery({
    queryKey: ["user-badges", userId],
    queryFn: () => fetchBadges({ data: { userId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando conquistas…</p>;
  if (!data || data.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
        Nenhuma conquista ainda. Faça check-ins para desbloquear! 🎯
      </div>
    );
  }

  // dedupe by slug (award may repeat per challenge)
  const seen = new Set<string>();
  const unique = data.filter((b) => {
    if (seen.has(b.slug)) return false;
    seen.add(b.slug);
    return true;
  });

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {unique.map((b) => (
        <div
          key={b.id + b.earned_at}
          className="group flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 text-center shadow-soft transition hover:border-primary/50"
          title={b.description}
        >
          <span className="text-3xl" aria-hidden>
            {b.icon}
          </span>
          <p className="text-[11px] font-bold leading-tight">{b.name}</p>
          <p className="text-[9px] text-muted-foreground">
            {new Date(b.earned_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
      ))}
    </div>
  );
}

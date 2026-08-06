import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Swords, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { listDuelsForChallenge, respondDuel } from "@/lib/duels.functions";

type Props = { challengeId: string };

export function PendingDuelsBanner({ challengeId }: Props) {
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const listFn = useServerFn(listDuelsForChallenge);
  const respondFn = useServerFn(respondDuel);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["duels", challengeId],
    queryFn: () => listFn({ data: { challengeId } }),
    enabled: !!meId,
  });

  const mutation = useMutation({
    mutationFn: (v: { duelId: string; action: "accept" | "decline" }) =>
      respondFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "accept" ? "Duelo aceito! 🔥" : "Duelo recusado.");
      qc.invalidateQueries({ queryKey: ["duels", challengeId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!meId || !data) return null;
  const pending = data.duels.filter(
    (d) => d.status === "pending" && d.opponent_id === meId && d.week_start === data.week_start,
  );
  if (pending.length === 0) return null;

  return (
    <div className="space-y-2 rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Swords className="size-5 text-primary" />
        <h2 className="font-display text-base font-bold">
          {pending.length === 1
            ? "Você foi desafiado(a)!"
            : `Você tem ${pending.length} duelos pendentes`}
        </h2>
      </div>
      <ul className="space-y-2">
        {pending.map((d) => {
          const c = d.challenger;
          const label = c?.username ? `@${c.username}` : c?.display_name ?? "Alguém";
          const initials = (c?.display_name ?? "??").slice(0, 2).toUpperCase();
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/70 p-3"
            >
              <Avatar className="size-10">
                <AvatarImage src={c?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{label}</span> te desafiou para um 1v1 nesta
                  semana, apostando{" "}
                  <span className="font-bold text-primary">
                    {d.stake_points} {d.stake_points === 1 ? "ponto" : "pontos"}
                  </span>
                  . Aceita?
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ duelId: d.id, action: "decline" })}
                >
                  <X className="mr-1 size-4" /> Recusar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ duelId: d.id, action: "accept" })}
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 size-4" />
                  )}
                  Aceitar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="text-right">
        <Link
          to="/c/$id/duels"
          params={{ id: challengeId }}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Ver todos os duelos →
        </Link>
      </div>
    </div>
  );
}

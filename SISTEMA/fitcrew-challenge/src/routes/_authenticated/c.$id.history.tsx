import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, Info } from "lucide-react";
import { SectionHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { getMyCheckinHistory, type CheckinHistoryRow } from "@/lib/checkin-history.functions";

export const Route = createFileRoute("/_authenticated/c/$id/history")({
  component: HistoryPage,
});

const REASON_LABEL: Record<string, string> = {
  ok: "Válido",
  duplicate_day: "Já pontuou nesse dia",
  over_weekly_limit: "Excedeu o limite semanal",
};

function StatusBadge({ row }: { row: CheckinHistoryRow }) {
  if (row.status === "rejected")
    return (
      <Badge className="rounded-full bg-destructive/15 text-destructive hover:bg-destructive/15">
        <XCircle className="mr-1 size-3" /> Rejeitado
      </Badge>
    );
  if (row.status === "over_limit")
    return (
      <Badge className="rounded-full bg-amber-500/15 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400">
        <AlertTriangle className="mr-1 size-3" /> Sobre limite
      </Badge>
    );
  if (row.status === "pending_review")
    return (
      <Badge className="rounded-full bg-blue-500/15 text-blue-600 hover:bg-blue-500/15 dark:text-blue-400">
        <Clock className="mr-1 size-3" /> Em revisão
      </Badge>
    );
  return (
    <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
      <CheckCircle2 className="mr-1 size-3" /> Válido
    </Badge>
  );
}

function HistoryPage() {
  const { id } = Route.useParams();
  const fn = useServerFn(getMyCheckinHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["my-checkin-history", id],
    queryFn: () => fn({ data: { challengeId: id } }),
  });

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const { rows, totals, challenge } = data;

  return (
    <>
      <SectionHeader
        title="Meu histórico"
        subtitle={`${challenge.name} · como cada check-in impactou seus pontos`}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total" value={totals.total_checkins} />
        <StatCard label="Válidos" value={totals.valid_checkins} accent="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Sobre limite" value={totals.over_limit} accent="text-amber-600 dark:text-amber-400" />
        <StatCard label="Pontos" value={totals.total_points} accent="text-primary" />
      </div>

      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Info className="size-4 text-primary" /> Como a pontuação é calculada
        </p>
        <p className="mt-1.5">
          <strong>Pontos ganhos</strong> = base do exercício + bônus de duração (+1 a cada{" "}
          <strong>{challenge.duration_bonus_step_min}min</strong> extras, teto de{" "}
          <strong>{challenge.duration_bonus_cap_pct}%</strong>) + bônus de streak (a partir do 3º dia
          consecutivo). Cooldown de <strong>{challenge.checkin_cooldown_min}min</strong> entre check-ins
          manuais. Só o 1º check-in do dia pontua e no máximo{" "}
          <strong>{challenge.max_days_per_week} dias/semana</strong> contam.
        </p>
      </div>

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Você ainda não fez check-ins neste desafio.
        </div>
      )}

      <ul className="space-y-3">
        {rows.map((r) => {
          const dt = new Date(r.created_at);
          const durationBonusCapped =
            r.points_duration_bonus > 0 &&
            r.points_duration_bonus >= Math.floor((r.exercise_base_points * challenge.duration_bonus_cap_pct) / 100);
          return (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{r.exercise_icon ?? "🏋️"}</span>
                    <span className="font-display font-bold">{r.exercise_name}</span>
                    <StatusBadge row={r} />
                    {r.source !== "manual" && (
                      <Badge variant="outline" className="rounded-full text-[10px] uppercase">
                        {r.source}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.occurred_on} · {r.duration_min} min · registrado {dt.toLocaleString("pt-BR")}
                  </p>
                  {r.caption && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{r.caption}</p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`font-display text-2xl font-bold leading-none ${
                      r.points_awarded > 0 ? "text-primary" : "text-muted-foreground line-through"
                    }`}
                  >
                    {r.points_awarded}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground">pontos</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="mt-3 rounded-xl bg-background/60 p-3 text-xs">
                <p className="mb-1.5 font-semibold text-foreground">Cálculo da pontuação</p>
                {r.status === "over_limit" || r.status === "rejected" ? (
                  <p className="text-muted-foreground">
                    ⚠️{" "}
                    {r.status === "rejected"
                      ? "Check-in rejeitado pela moderação — não gera pontos."
                      : REASON_LABEL[r.points_reason ?? ""] ??
                        "Check-in não pontua nesta semana (limite atingido)."}
                  </p>
                ) : (
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      • Base do exercício: <strong className="text-foreground">{r.points_base} pts</strong>
                    </li>
                    <li>
                      • Bônus por duração ({Math.max(0, r.duration_min - r.exercise_min_minutes)} min extras
                      a cada {challenge.duration_bonus_step_min} min):{" "}
                      <strong className="text-foreground">+{r.points_duration_bonus} pts</strong>
                      {durationBonusCapped && (
                        <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          teto {challenge.duration_bonus_cap_pct}% atingido
                        </span>
                      )}
                    </li>
                    <li>
                      • Bônus de streak:{" "}
                      <strong className="text-foreground">+{r.points_streak_bonus} pts</strong>
                      {r.points_streak_bonus === 0 && challenge.streak_bonus_points > 0 && (
                        <span className="ml-1 text-[11px]">
                          (ative a partir do 3º dia consecutivo)
                        </span>
                      )}
                    </li>
                    <li className="pt-1 text-foreground">
                      = <strong>{r.points_awarded} pontos</strong>
                    </li>
                  </ul>
                )}
                {r.photo_flagged && r.photo_flag_reason && (
                  <p className="mt-2 rounded-md bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                    ⚑ Foto marcada: {r.photo_flag_reason}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center shadow-soft">
      <p className={`font-display text-2xl font-bold ${accent ?? ""}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

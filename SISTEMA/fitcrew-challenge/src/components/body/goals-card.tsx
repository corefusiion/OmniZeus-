import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, TrendingDown, TrendingUp, Target } from "lucide-react";
import { generateBodyGoals } from "@/lib/body-goals.functions";

export function BodyGoalsCard({ metricId }: { metricId: string | null | undefined }) {
  const fn = useServerFn(generateBodyGoals);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["body-goals", metricId],
    queryFn: () => fn({ data: { metricId: metricId! } }),
    enabled: !!metricId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!metricId) return null;
  if (isError) return null;

  return (
    <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          Coach — Dicas de controle
        </h3>
      </div>

      {isLoading || !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Analisando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              icon={<Target className="size-3" />}
              label="Peso ideal"
              value={data.idealWeightKg != null ? `${data.idealWeightKg} kg` : "—"}
            />
            <DeltaStat
              label="Δ Peso"
              value={data.weightDeltaKg}
              positiveMeansGood={false}
              suffix="kg"
            />
            <DeltaStat
              label="Δ Gordura"
              value={data.fatDeltaKg}
              positiveMeansGood={false}
              suffix="kg"
              invert
            />
            <DeltaStat
              label="Δ Músculo"
              value={data.muscleDeltaKg}
              positiveMeansGood
              suffix="kg"
            />
          </div>

          {data.narrative && (
            <p className="mt-4 rounded-2xl bg-secondary/40 p-3 text-sm leading-relaxed">
              {data.narrative}
            </p>
          )}
        </>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">
        ⚠️ Estimativa educativa. Não substitui orientação profissional.
      </p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-2.5">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

function DeltaStat({
  label,
  value,
  positiveMeansGood,
  suffix,
  invert,
}: {
  label: string;
  value: number | null;
  positiveMeansGood: boolean;
  suffix: string;
  invert?: boolean;
}) {
  if (value == null) return <Stat label={label} value="—" />;
  // For fat (invert): we say "reduzir X kg" so positive fat_delta means gordura excedente => precisa reduzir
  const displayValue = invert ? -value : value;
  const good = positiveMeansGood ? value > 0 : value <= 0;
  const color = good ? "text-emerald-500" : "text-orange-500";
  const Icon = displayValue < 0 ? TrendingDown : TrendingUp;
  return (
    <div className="rounded-2xl border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 flex items-center gap-1 font-display text-base font-bold tabular-nums ${color}`}>
        <Icon className="size-3" />
        {displayValue > 0 ? "+" : ""}
        {displayValue.toFixed(1)} {suffix}
      </p>
    </div>
  );
}

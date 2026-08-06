import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, Flame, ImageOff, Loader2, Pause, Play, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getBeforeAfterPhotos,
  getMyMembership,
  listBodyMetricsHistory,
  pauseChallenge,
  resumeChallenge,
} from "@/lib/progress.functions";
import { recordBodyMetrics } from "@/lib/metrics.functions";
import { getLatestComposition } from "@/lib/composition.functions";
import { BodyScanWizard } from "@/components/body/scan-wizard";
import { CompositionSilhouette } from "@/components/body/composition-silhouette";
import { BodyTypeGrid } from "@/components/body/body-type-grid";
import { BodyGoalsCard } from "@/components/body/goals-card";
import { WeighInCard } from "@/components/challenge/weigh-in-card";


export const Route = createFileRoute("/_authenticated/c/$id/progress")({
  component: ProgressPage,
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ProgressPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const historyFn = useServerFn(listBodyMetricsHistory);
  const membershipFn = useServerFn(getMyMembership);
  const beforeAfterFn = useServerFn(getBeforeAfterPhotos);
  const recordFn = useServerFn(recordBodyMetrics);
  const pauseFn = useServerFn(pauseChallenge);
  const resumeFn = useServerFn(resumeChallenge);

  const historyQ = useQuery({
    queryKey: ["body-metrics-history"],
    queryFn: () => historyFn(),
  });
  const memberQ = useQuery({
    queryKey: ["my-membership", id],
    queryFn: () => membershipFn({ data: { challengeId: id } }),
  });
  const compositionFn = useServerFn(getLatestComposition);
  const compositionQ = useQuery({
    queryKey: ["latest-composition"],
    queryFn: () => compositionFn(),
  });

  const history = historyQ.data?.history ?? [];
  const membership = memberQ.data?.membership ?? null;
  const composition = compositionQ.data?.latest ?? null;
  const compProfile = compositionQ.data?.profile ?? { sex: null, heightCm: null };

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        date: h.recorded_at.slice(0, 10),
        label: fmtDate(h.recorded_at),
        weight: Number(h.weight_kg),
        bmi: h.bmi != null ? Number(h.bmi) : null,
      })),
    [history],
  );

  // Form: novo registro
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const recordMut = useMutation({
    mutationFn: (payload: { weight_kg: number; height_cm: number | null }) =>
      recordFn({ data: { weight_kg: payload.weight_kg, height_cm: payload.height_cm ?? null } }),
    onSuccess: () => {
      toast.success("Medição registrada!");
      setWeight("");
      qc.invalidateQueries({ queryKey: ["body-metrics-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Before/After
  const [beforeDate, setBeforeDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [afterDate, setAfterDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const baQ = useQuery({
    queryKey: ["before-after", id, beforeDate, afterDate],
    queryFn: () => beforeAfterFn({ data: { challengeId: id, beforeDate, afterDate } }),
  });

  // AI Body Scan
  const [scanOpen, setScanOpen] = useState(false);
  const lastMetric = history[history.length - 1];

  // Pausa

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseDays, setPauseDays] = useState(3);
  const [pauseReason, setPauseReason] = useState("");
  const pauseMut = useMutation({
    mutationFn: () => pauseFn({ data: { challengeId: id, days: pauseDays, reason: pauseReason || null } }),
    onSuccess: () => {
      toast.success("Desafio pausado. Sua streak está protegida.");
      setPauseOpen(false);
      setPauseReason("");
      qc.invalidateQueries({ queryKey: ["my-membership", id] });
      qc.invalidateQueries({ queryKey: ["challenge-hub", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resumeMut = useMutation({
    mutationFn: () => resumeFn({ data: { challengeId: id } }),
    onSuccess: () => {
      toast.success("Pausa encerrada.");
      qc.invalidateQueries({ queryKey: ["my-membership", id] });
      qc.invalidateQueries({ queryKey: ["challenge-hub", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isPaused =
    membership?.paused_until != null &&
    new Date(membership.paused_until + "T23:59:59").getTime() >= Date.now();

  const cooldownActive =
    membership?.last_pause_at != null &&
    Date.now() - new Date(membership.last_pause_at).getTime() < 30 * 86_400_000 &&
    !isPaused;

  const deltaWeight =
    baQ.data?.beforeMetric && baQ.data.afterMetric
      ? +(Number(baQ.data.afterMetric.weight_kg) - Number(baQ.data.beforeMetric.weight_kg)).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Ritual de pesagem semanal */}
      <WeighInCard challengeId={id} />

      {/* Streak + Pausa */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
            <Flame className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-none">
              {membership?.current_streak ?? 0} dias seguidos
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Recorde pessoal: {membership?.longest_streak ?? 0} dias
            </p>
          </div>
          {isPaused ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
                <CalendarClock className="size-3.5" />
                Pausado até {new Date(membership!.paused_until! + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
              <Button size="sm" variant="outline" onClick={() => resumeMut.mutate()} disabled={resumeMut.isPending}>
                {resumeMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Retomar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPauseOpen(true)}
              disabled={cooldownActive}
              title={cooldownActive ? "Você já pausou nos últimos 30 dias" : undefined}
            >
              <Pause className="size-4" /> Pausar
            </Button>
          )}
        </div>
        {cooldownActive && (
          <p className="mt-3 text-xs text-muted-foreground">
            ⏳ Próxima pausa disponível em{" "}
            {Math.ceil(
              (new Date(membership!.last_pause_at!).getTime() + 30 * 86_400_000 - Date.now()) / 86_400_000,
            )}{" "}
            dias.
          </p>
        )}
      </section>

      {/* AI Body Scan */}
      <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-tight">AI Body Scan</p>
            <p className="text-xs text-muted-foreground">
              Estimativa de composição corporal a partir de 2 fotos. Privado por padrão.
            </p>
          </div>
          <Button size="sm" onClick={() => setScanOpen(true)}>
            <Sparkles className="size-4" /> Analisar
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Limite: 3 análises por mês. Suas fotos ficam privadas.
        </p>
      </section>

      {/* Composição corporal (silhueta + tipo + coach) */}
      {composition && (composition.bodyFatPct != null || composition.musclePct != null) && (
        <section className="space-y-4">
          <CompositionSilhouette
            waterPct={composition.waterPct}
            bodyFatPct={composition.bodyFatPct}
            musclePct={composition.musclePct}
            bmi={composition.bmi}
            sex={compProfile.sex}
          />
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <BodyTypeGrid
              bmi={composition.bmi}
              fatPct={composition.bodyFatPct}
              sex={compProfile.sex}
            />
          </div>
          <BodyGoalsCard metricId={composition.id} />
        </section>
      )}

      {/* Gráfico */}


      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Evolução do peso</h2>
          <p className="text-xs text-muted-foreground">{history.length} medições</p>
        </div>
        {chartData.length < 2 ? (
          <p className="rounded-2xl bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
            Registre ao menos duas medições para ver o gráfico.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <RLineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Peso (kg)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </RLineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Registrar nova medição */}
        <form
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const w = Number(weight.replace(",", "."));
            const h = height ? Number(height) : null;
            if (!w || w < 20 || w > 400) return toast.error("Peso inválido");
            recordMut.mutate({ weight_kg: w, height_cm: h });
          }}
        >
          <div>
            <Label htmlFor="w" className="text-xs">Peso (kg)</Label>
            <Input id="w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex. 72.4" />
          </div>
          <div>
            <Label htmlFor="h" className="text-xs">Altura (cm)</Label>
            <Input id="h" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="opcional" />
          </div>
          <Button type="submit" className="col-span-2 mt-auto sm:col-span-1" disabled={recordMut.isPending}>
            {recordMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Registrar"}
          </Button>
        </form>
      </section>

      {/* Before / After */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-3 font-display text-xl font-bold">Antes / Depois</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="d1" className="text-xs">Antes</Label>
            <Input id="d1" type="date" value={beforeDate} onChange={(e) => setBeforeDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="d2" className="text-xs">Depois</Label>
            <Input id="d2" type="date" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <PhotoCard label="Antes" data={baQ.data?.before} metric={baQ.data?.beforeMetric} />
          <PhotoCard label="Depois" data={baQ.data?.after} metric={baQ.data?.afterMetric} />
        </div>

        {deltaWeight != null && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-secondary/40 p-3 text-sm">
            {deltaWeight < 0 ? (
              <TrendingDown className="size-4 text-emerald-500" />
            ) : deltaWeight > 0 ? (
              <TrendingUp className="size-4 text-orange-500" />
            ) : null}
            <span className="font-semibold tabular-nums">
              {deltaWeight > 0 ? "+" : ""}
              {deltaWeight.toFixed(1)} kg
            </span>
            <span className="text-muted-foreground">entre as duas datas</span>
          </div>
        )}
      </section>

      {/* Pausa modal */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar desafio</DialogTitle>
            <DialogDescription>
              Sua sequência fica protegida durante a pausa. Máx. 7 dias, 1 vez a cada 30 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Duração</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 5, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPauseDays(d)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      pauseDays === d
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d} {d === 1 ? "dia" : "dias"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="reason" className="text-xs">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                rows={2}
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="Viagem, gripe, prova…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPauseOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
              {pauseMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Confirmar pausa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BodyScanWizard
        open={scanOpen}
        onOpenChange={setScanOpen}
        challengeId={id}
        defaultWeight={lastMetric?.weight_kg ? Number(lastMetric.weight_kg) : null}
        defaultHeight={lastMetric?.height_cm ?? null}
        onDone={() => qc.invalidateQueries({ queryKey: ["body-metrics-history"] })}
      />
    </div>
  );
}


function PhotoCard({
  label,
  data,
  metric,
}: {
  label: string;
  data: { photo_signed_url: string | null; occurred_on: string; duration_min: number } | null | undefined;
  metric: { weight_kg: number; recorded_at: string } | null | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-secondary/30">
      <div className="relative aspect-square bg-secondary">
        {data?.photo_signed_url ? (
          <img src={data.photo_signed_url} alt={label} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-6" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          {label}
        </span>
      </div>
      <div className="p-2.5 text-xs">
        <p className="font-semibold">
          {data?.occurred_on ? new Date(data.occurred_on + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
        </p>
        <p className="text-muted-foreground tabular-nums">
          {metric?.weight_kg != null ? `${Number(metric.weight_kg).toFixed(1)} kg` : "Sem métrica"}
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, Loader2, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getWeighInStatus, recordWeighIn } from "@/lib/weigh-in.functions";
import { BluetoothScaleButton } from "@/components/body/bluetooth-scale-button";
import { ClassificationBar } from "@/components/body/classification-bar";
import { bmi as calcBmi } from "@/lib/body-classification";
import type { ScaleReading } from "@/lib/bluetooth-scale";


const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MOODS = ["🔥", "😎", "🙂", "😐", "😞"];

export function WeighInCard({ challengeId }: { challengeId: string }) {
  const qc = useQueryClient();
  const statusFn = useServerFn(getWeighInStatus);
  const recordFn = useServerFn(recordWeighIn);

  const { data, isLoading } = useQuery({
    queryKey: ["weigh-in-status", challengeId],
    queryFn: () => statusFn({ data: { challengeId } }),
  });

  const [weight, setWeight] = useState("");
  const [mood, setMood] = useState<string>("🙂");
  const [share, setShare] = useState(false);
  const [waist, setWaist] = useState("");
  const [scaleReading, setScaleReading] = useState<ScaleReading | null>(null);

  const recordMut = useMutation({
    mutationFn: () =>
      recordFn({
        data: {
          challengeId,
          weight_kg: Number(weight.replace(",", ".")),
          mood,
          shareWithChallenge: share,
          note: null,
          source: scaleReading ? "bluetooth" : "manual",
          body_fat_pct: scaleReading?.bodyFatPct ?? null,
          muscle_mass_pct: scaleReading?.musclePct ?? null,
          water_pct: scaleReading?.waterPct ?? null,
          visceral_fat: scaleReading?.visceralFat ?? null,
          metabolic_age: scaleReading?.metabolicAge ?? null,
          waist_cm: waist ? Number(waist.replace(",", ".")) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Pesagem semanal registrada! 🎯");
      setWeight("");
      setWaist("");
      setScaleReading(null);
      qc.invalidateQueries({ queryKey: ["weigh-in-status", challengeId] });
      qc.invalidateQueries({ queryKey: ["body-metrics-history"] });
      qc.invalidateQueries({ queryKey: ["challenge-hub", challengeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading || !data?.enabled) return null;

  const delta =
    data.previousWeight != null && data.currentWeight != null
      ? +(data.currentWeight - data.previousWeight).toFixed(1)
      : null;

  if (data.alreadyWeighedThisWeek) {
    return (
      <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500">
            <CalendarCheck2 className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold">Pesagem da semana feita ✅</p>
            <p className="text-xs text-muted-foreground">
              {data.currentWeight?.toFixed(1)} kg
              {delta != null && ` · vs semana passada `}
              {delta != null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${
                    delta < 0 ? "text-emerald-500" : delta > 0 ? "text-orange-500" : "text-muted-foreground"
                  }`}
                >
                  {delta < 0 ? <TrendingDown className="size-3" /> : delta > 0 ? <TrendingUp className="size-3" /> : null}
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} kg
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              🔥 {data.streak} semanas seguidas · recorde {data.longestStreak}
            </p>
          </div>
        </div>
        {data.currentBmi != null && (
          <div className="mt-3 border-t border-emerald-500/20 pt-3">
            <ClassificationBar bmi={data.currentBmi} />
          </div>
        )}
      </section>
    );
  }

  if (!data.isWeighInDay) {
    return (
      <section className="rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-secondary text-muted-foreground">
            <Scale className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Dia da pesagem: {DAY_NAMES[data.weighInDay]}.</p>
            <p className="text-xs text-muted-foreground">
              🔥 {data.streak} semanas seguidas
            </p>
          </div>
        </div>
      </section>
    );
  }

  // hoje é o dia e ainda não pesou
  return (
    <section className="rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-5 shadow-flame">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Scale className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">Hora da pesagem semanal 🎯</p>
          <p className="text-xs text-muted-foreground">
            🔥 {data.streak} semanas · seu ritual de hoje
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <BluetoothScaleButton
          onReading={(r) => {
            setScaleReading(r);
            setWeight(r.weightKg.toFixed(1));
          }}
        />
        {scaleReading && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">
            via balança
          </span>
        )}
      </div>

      {scaleReading && (scaleReading.bodyFatPct || scaleReading.musclePct || scaleReading.waterPct) && (
        <div className="mb-3 grid grid-cols-3 gap-2 rounded-2xl bg-blue-500/5 p-2 text-center">
          {scaleReading.bodyFatPct != null && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Gordura</p>
              <p className="font-display text-sm font-bold">{scaleReading.bodyFatPct.toFixed(1)}%</p>
            </div>
          )}
          {scaleReading.musclePct != null && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Músculo</p>
              <p className="font-display text-sm font-bold">{scaleReading.musclePct.toFixed(1)}%</p>
            </div>
          )}
          {scaleReading.waterPct != null && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Água</p>
              <p className="font-display text-sm font-bold">{scaleReading.waterPct.toFixed(1)}%</p>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const w = Number(weight.replace(",", "."));
          if (!w || w < 20 || w > 400) return toast.error("Peso inválido");
          recordMut.mutate();
        }}
        className="space-y-3"
      >

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <Label htmlFor="wi-w" className="text-xs">Peso (kg)</Label>
            <Input
              id="wi-w"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="ex. 72.4"
              autoFocus
            />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs">Como está?</Label>
            <div className="mt-1 flex gap-1">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={`grid size-9 place-items-center rounded-lg text-lg transition ${
                    mood === m ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/70"
                  }`}
                  aria-label={m}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs">
          <span>
            <span className="font-semibold">Compartilhar com o desafio</span>
            <span className="ml-1 text-muted-foreground">(só delta, valor absoluto fica privado)</span>
          </span>
          <Switch checked={share} onCheckedChange={setShare} />
        </label>

        <details className="rounded-xl bg-secondary/30 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">
            + Medida de cintura (opcional)
          </summary>
          <div className="mt-2">
            <Input
              inputMode="decimal"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              placeholder="cm — indicador de risco cardiovascular"
            />
          </div>
        </details>

        {(() => {
          const w = Number(weight.replace(",", "."));
          const bmiVal = w && data.heightCm ? calcBmi(w, data.heightCm) : null;
          if (bmiVal == null) return null;
          return (
            <div className="rounded-xl border border-border bg-card/50 p-3">
              <ClassificationBar bmi={bmiVal} compact />
            </div>
          );
        })()}

        <Button type="submit" className="w-full" disabled={recordMut.isPending}>
          {recordMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Registrar pesagem"}
        </Button>
      </form>
    </section>
  );
}

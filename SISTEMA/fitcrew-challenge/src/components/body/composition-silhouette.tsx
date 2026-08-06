import {
  COMPOSITION_RANGES,
  inRange,
  classifyBMI,
  BMI_CLASS_META,
} from "@/lib/body-classification";

type Metric = { label: string; value: number; low: number; high: number; unit?: string };

const STATUS_LABEL = { baixo: "Baixo", saudavel: "Saudável", alto: "Alto" } as const;
const STATUS_COLOR = {
  baixo: "hsl(200 90% 60%)",
  saudavel: "hsl(142 70% 45%)",
  alto: "hsl(38 92% 55%)",
} as const;

function Silhouette({ female }: { female: boolean }) {
  // Simple SVG silhouette (front view). Fill via CSS token so it themes.
  return (
    <svg viewBox="0 0 100 200" className="h-40 w-auto text-primary/25">
      {female ? (
        <path
          fill="currentColor"
          d="M50 8c-8 0-14 6-14 14 0 6 2 10 6 13-4 3-8 8-8 15v10c0 4 2 7 5 9l-6 20c-2 8-4 18-4 26 0 5 3 8 7 8h4l2 40c0 4 3 7 8 7s8-3 8-7l2-40h4l2 40c0 4 3 7 8 7s8-3 8-7l2-40h4c4 0 7-3 7-8 0-8-2-18-4-26l-6-20c3-2 5-5 5-9V50c0-7-4-12-8-15 4-3 6-7 6-13 0-8-6-14-14-14z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M50 8c-8 0-14 6-14 14s6 14 14 14 14-6 14-14S58 8 50 8zM30 55c-3 0-5 3-5 6l4 30c0 3 2 5 5 5v40c-1 8-3 18-3 26 0 4 3 7 7 7h3l2 26c0 3 3 5 7 5s7-2 7-5l2-26h3c4 0 7-3 7-7 0-8-2-18-3-26v-40c3 0 5-2 5-5l4-30c0-3-2-6-5-6H30z"
        />
      )}
    </svg>
  );
}

export function CompositionSilhouette({
  waterPct,
  bodyFatPct,
  musclePct,
  bmi,
  sex,
}: {
  waterPct?: number | null;
  bodyFatPct?: number | null;
  musclePct?: number | null;
  bmi?: number | null;
  sex?: "male" | "female" | null;
}) {
  const female = sex === "female";
  const fatRange = female
    ? COMPOSITION_RANGES.body_fat_pct_female
    : COMPOSITION_RANGES.body_fat_pct_male;
  const muscleRange = female
    ? COMPOSITION_RANGES.muscle_mass_pct_female
    : COMPOSITION_RANGES.muscle_mass_pct_male;

  const rows: Metric[] = [];
  if (waterPct != null)
    rows.push({
      label: "Água",
      value: waterPct,
      low: COMPOSITION_RANGES.water_pct.low,
      high: COMPOSITION_RANGES.water_pct.high,
      unit: "%",
    });
  if (bodyFatPct != null)
    rows.push({ label: "Gordura", value: bodyFatPct, low: fatRange.low, high: fatRange.high, unit: "%" });
  if (musclePct != null)
    rows.push({ label: "Músculo", value: musclePct, low: muscleRange.low, high: muscleRange.high, unit: "%" });

  if (rows.length === 0) return null;

  const bmiClass = classifyBMI(bmi);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          Composição
        </h3>
        {bmi != null && bmiClass && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
            style={{ background: BMI_CLASS_META[bmiClass].color }}
          >
            IMC {bmi.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Silhouette female={female} />

        <div className="flex-1 space-y-2.5">
          {rows.map((m) => {
            const status = inRange(m.value, m.low, m.high);
            const color = STATUS_COLOR[status];
            // Position of value on 0-100% scale for visual bar
            const min = Math.max(0, m.low - (m.high - m.low) * 0.5);
            const max = m.high + (m.high - m.low) * 0.5;
            const pos = Math.min(100, Math.max(0, ((m.value - min) / (max - min)) * 100));
            const lowPos = ((m.low - min) / (max - min)) * 100;
            const highPos = ((m.high - min) / (max - min)) * 100;

            return (
              <div key={m.label}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">{m.label}</span>
                  <span className="font-bold tabular-nums" style={{ color }}>
                    {m.value.toFixed(1)}
                    {m.unit}
                    <span className="ml-1 text-[10px] font-semibold uppercase">
                      {STATUS_LABEL[status]}
                    </span>
                  </span>
                </div>
                <div className="relative mt-1 h-2 rounded-full bg-secondary">
                  {/* saudável range shading */}
                  <div
                    className="absolute inset-y-0 rounded-full bg-emerald-500/25"
                    style={{ left: `${lowPos}%`, right: `${100 - highPos}%` }}
                  />
                  {/* dot */}
                  <div
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
                    style={{ left: `${pos}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Faixa verde = saudável para {female ? "mulheres" : "homens"} adultos. Referências educativas.
      </p>
    </div>
  );
}

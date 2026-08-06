import {
  BODY_TYPE_GRID,
  BODY_TYPE_LABEL,
  bodyTypeGridPosition,
  classifyBodyType,
  type BodyTypeKey,
} from "@/lib/body-classification";

const NEGATIVE: BodyTypeKey[] = ["obesidade", "obesidade_muscular", "obesidade_oculta", "magro_esqueletico"];
const POSITIVE: BodyTypeKey[] = ["atleta", "saudavel", "muscular_esbelto"];

function tone(key: BodyTypeKey, active: boolean) {
  if (!active) return "border-border bg-secondary/30 text-muted-foreground";
  if (NEGATIVE.includes(key)) return "border-red-500 bg-red-500/10 text-red-500 shadow-lg shadow-red-500/20";
  if (POSITIVE.includes(key)) return "border-emerald-500 bg-emerald-500/10 text-emerald-500 shadow-lg shadow-emerald-500/20";
  return "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/20";
}

export function BodyTypeGrid({
  bmi,
  fatPct,
  sex,
}: {
  bmi: number | null | undefined;
  fatPct: number | null | undefined;
  sex: "male" | "female" | null | undefined;
}) {
  const activeKey =
    bmi != null && fatPct != null ? classifyBodyType(bmi, fatPct, sex) : null;
  const pos = activeKey ? bodyTypeGridPosition(activeKey) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">
          Tipo de corpo
        </h3>
        {activeKey && (
          <span className="text-[11px] font-semibold text-primary">
            {BODY_TYPE_LABEL[activeKey]}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {/* Y axis label: IMC */}
        <div className="flex w-4 flex-col justify-between py-1 text-[9px] font-semibold uppercase text-muted-foreground [writing-mode:vertical-rl]">
          <span>Alto</span>
          <span className="rotate-180">IMC</span>
          <span>Baixo</span>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-1.5">
          {BODY_TYPE_GRID.flatMap((row, rIdx) =>
            row.map((key, cIdx) => {
              const active = pos?.row === rIdx && pos?.col === cIdx;
              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={`grid aspect-[4/3] place-items-center rounded-xl border-2 p-1 text-center text-[10px] font-semibold leading-tight transition ${tone(
                    key,
                    active,
                  )}`}
                >
                  {BODY_TYPE_LABEL[key]}
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div className="ml-6 flex justify-between text-[9px] font-semibold uppercase text-muted-foreground">
        <span>← Menos gordura</span>
        <span>Gordura</span>
        <span>Mais gordura →</span>
      </div>
    </div>
  );
}

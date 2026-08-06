import { classifyBMI, BMI_CLASS_META, type BMIClass } from "@/lib/body-classification";

const ORDER: BMIClass[] = ["baixo", "saudavel", "alto", "obeso"];

export function ClassificationBar({
  bmi,
  compact = false,
}: {
  bmi: number | null | undefined;
  compact?: boolean;
}) {
  const current = classifyBMI(bmi);
  if (current == null || bmi == null) return null;

  return (
    <div className="w-full">
      <div className="flex gap-1">
        {ORDER.map((k) => {
          const meta = BMI_CLASS_META[k];
          const active = k === current;
          return (
            <div key={k} className="relative flex-1">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  background: meta.color,
                  opacity: active ? 1 : 0.28,
                }}
              />
              {active && (
                <div
                  className="absolute -top-1 left-1/2 grid size-3.5 -translate-x-1/2 place-items-center rounded-full text-[10px]"
                  style={{ background: meta.color }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          {ORDER.map((k) => (
            <span
              key={k}
              className={k === current ? "font-bold text-foreground" : ""}
              style={k === current ? { color: BMI_CLASS_META[k].color } : undefined}
            >
              {BMI_CLASS_META[k].label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-bold tabular-nums">{bmi.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground">IMC</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ background: BMI_CLASS_META[current].color }}
        >
          {BMI_CLASS_META[current].label}
        </span>
      </div>
    </div>
  );
}

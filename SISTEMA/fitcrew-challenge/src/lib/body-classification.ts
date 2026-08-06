/**
 * Pure client-safe helpers for body classification (BMI ranges, body-type grid,
 * ideal weight, waist-to-height ratio). No server / DB dependencies.
 */

export type BMIClass = "baixo" | "saudavel" | "alto" | "obeso";

export type BodyTypeKey =
  | "magro_esqueletico"
  | "magro"
  | "levemente_abaixo"
  | "muscular_esbelto"
  | "saudavel"
  | "levemente_acima"
  | "atleta"
  | "obesidade_muscular"
  | "obesidade"
  | "obesidade_oculta";

export const BODY_TYPE_LABEL: Record<BodyTypeKey, string> = {
  magro_esqueletico: "Magro e esquelético",
  magro: "Magro",
  levemente_abaixo: "Levemente abaixo",
  muscular_esbelto: "Muscular esbelto",
  saudavel: "Saudável",
  levemente_acima: "Levemente acima",
  atleta: "Atleta",
  obesidade_muscular: "Obesidade muscular",
  obesidade: "Obesidade",
  obesidade_oculta: "Obesidade oculta",
};

export function classifyBMI(bmi: number | null | undefined): BMIClass | null {
  if (bmi == null || !isFinite(bmi)) return null;
  if (bmi < 18.5) return "baixo";
  if (bmi < 25) return "saudavel";
  if (bmi < 30) return "alto";
  return "obeso";
}

export const BMI_CLASS_META: Record<
  BMIClass,
  { label: string; color: string; range: string }
> = {
  baixo: { label: "Baixo", color: "hsl(200 90% 60%)", range: "< 18.5" },
  saudavel: { label: "Saudável", color: "hsl(142 70% 45%)", range: "18.5–24.9" },
  alto: { label: "Alto", color: "hsl(38 92% 55%)", range: "25–29.9" },
  obeso: { label: "Obeso", color: "hsl(0 84% 55%)", range: "≥ 30" },
};

export function bmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  return +(weightKg / Math.pow(heightCm / 100, 2)).toFixed(1);
}

/** Fat % thresholds (adult, ACE/AAAI midpoints). */
export function fatCategory(
  fatPct: number,
  sex: "male" | "female" | null | undefined,
): "baixo" | "medio" | "alto" {
  if (sex === "female") {
    if (fatPct < 21) return "baixo";
    if (fatPct < 32) return "medio";
    return "alto";
  }
  // default masculino
  if (fatPct < 14) return "baixo";
  if (fatPct < 25) return "medio";
  return "alto";
}

function bmiCategory(bmiVal: number): "baixo" | "medio" | "alto" {
  if (bmiVal < 18.5) return "baixo";
  if (bmiVal < 25) return "medio";
  return "alto"; // 25+ (inclui obeso — o cruzamento com gordura refina)
}

/**
 * 3x3 grid: IMC (linhas: baixo/medio/alto) × Gordura (colunas: baixo/medio/alto).
 * Devolve o quadrante do usuário.
 */
export function classifyBodyType(
  bmiVal: number,
  fatPct: number,
  sex: "male" | "female" | null | undefined,
): BodyTypeKey {
  const b = bmiCategory(bmiVal);
  const f = fatCategory(fatPct, sex);

  // linhas = IMC, colunas = Gordura
  const grid: Record<string, Record<string, BodyTypeKey>> = {
    baixo: {
      baixo: "magro_esqueletico",
      medio: "magro",
      alto: "levemente_abaixo",
    },
    medio: {
      baixo: "muscular_esbelto",
      medio: "saudavel",
      alto: "obesidade_oculta",
    },
    alto: {
      baixo: "atleta",
      medio: "obesidade_muscular",
      alto: bmiVal >= 30 ? "obesidade" : "levemente_acima",
    },
  };

  return grid[b][f];
}

export const BODY_TYPE_GRID: BodyTypeKey[][] = [
  // Linha 0 = IMC alto (topo). Ordem colunas = Gordura: baixo, medio, alto
  ["atleta", "obesidade_muscular", "obesidade"],
  ["muscular_esbelto", "saudavel", "obesidade_oculta"],
  ["magro_esqueletico", "magro", "levemente_abaixo"],
];

export function bodyTypeGridPosition(key: BodyTypeKey): { row: number; col: number } | null {
  for (let r = 0; r < BODY_TYPE_GRID.length; r++) {
    for (let c = 0; c < BODY_TYPE_GRID[r].length; c++) {
      if (BODY_TYPE_GRID[r][c] === key) return { row: r, col: c };
    }
  }
  return null;
}

/** Devine formula, adjusted slightly for BR population. Returns kg. */
export function idealWeight(
  heightCm: number,
  sex: "male" | "female" | null | undefined,
): number | null {
  if (!heightCm || heightCm < 130) return null;
  const inchesOver5ft = heightCm / 2.54 - 60;
  const base = sex === "female" ? 45.5 : 50;
  const w = base + 2.3 * inchesOver5ft;
  return +Math.max(40, w).toFixed(1);
}

/** Cintura/estatura. < 0.5 saudável, 0.5–0.6 alerta, > 0.6 alto risco. */
export function waistToHeightRatio(waistCm: number, heightCm: number): number | null {
  if (!waistCm || !heightCm || heightCm <= 0) return null;
  return +(waistCm / heightCm).toFixed(2);
}

export function classifyWHtR(ratio: number): "saudavel" | "alerta" | "alto_risco" {
  if (ratio < 0.5) return "saudavel";
  if (ratio < 0.6) return "alerta";
  return "alto_risco";
}

/** Faixas de referência p/ silhueta (adulto genérico). */
export const COMPOSITION_RANGES = {
  water_pct: { low: 45, high: 65, label: "Água" },
  body_fat_pct_male: { low: 8, high: 24, label: "Gordura" },
  body_fat_pct_female: { low: 21, high: 33, label: "Gordura" },
  muscle_mass_pct_male: { low: 40, high: 55, label: "Músculo" },
  muscle_mass_pct_female: { low: 33, high: 50, label: "Músculo" },
} as const;

export function inRange(value: number, low: number, high: number): "baixo" | "saudavel" | "alto" {
  if (value < low) return "baixo";
  if (value > high) return "alto";
  return "saudavel";
}

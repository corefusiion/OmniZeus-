// Base de conhecimento interna do Coach FitCrew.
// Traduzido dos arquivos calorie-guide.md e exercise-database.md
// para uso nativo em TypeScript (sem depender de arquivos externos).

export type FoodItem = {
  name: string;
  category:
    | "proteina"
    | "carboidrato"
    | "gordura"
    | "vegetal"
    | "laticinio"
    | "outro";
  perPortion: string; // ex: "100g"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export const FOOD_DB: FoodItem[] = [
  // Proteínas
  { name: "Frango grelhado (peito)", category: "proteina", perPortion: "100g", calories: 159, protein: 32, carbs: 0, fat: 3 },
  { name: "Frango grelhado (coxa)", category: "proteina", perPortion: "100g", calories: 208, protein: 26, carbs: 0, fat: 11 },
  { name: "Patinho moído (cru)", category: "proteina", perPortion: "100g", calories: 219, protein: 21, carbs: 0, fat: 14 },
  { name: "Carne moída extra magra (cozida)", category: "proteina", perPortion: "100g", calories: 171, protein: 27, carbs: 0, fat: 7 },
  { name: "Tilápia grelhada", category: "proteina", perPortion: "100g", calories: 128, protein: 26, carbs: 0, fat: 3 },
  { name: "Salmão grelhado", category: "proteina", perPortion: "100g", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "Atum em lata (ao natural)", category: "proteina", perPortion: "100g", calories: 116, protein: 26, carbs: 0, fat: 1 },
  { name: "Ovo inteiro (1 unid grande)", category: "proteina", perPortion: "50g", calories: 70, protein: 6, carbs: 0.6, fat: 5 },
  { name: "Clara de ovo", category: "proteina", perPortion: "100g", calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
  { name: "Iogurte grego integral (sem açúcar)", category: "laticinio", perPortion: "100g", calories: 97, protein: 9, carbs: 3.8, fat: 5 },
  { name: "Queijo cottage", category: "laticinio", perPortion: "100g", calories: 72, protein: 12, carbs: 4, fat: 2 },
  { name: "Whey protein (1 scoop ~30g)", category: "proteina", perPortion: "30g", calories: 120, protein: 24, carbs: 3, fat: 2 },
  { name: "Tofu", category: "proteina", perPortion: "100g", calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  { name: "Lentilha cozida", category: "proteina", perPortion: "100g", calories: 116, protein: 9, carbs: 20, fat: 0.4 },
  { name: "Feijão carioca cozido", category: "proteina", perPortion: "100g", calories: 76, protein: 4.8, carbs: 13.6, fat: 0.5 },
  { name: "Feijão preto cozido", category: "proteina", perPortion: "100g", calories: 77, protein: 4.5, carbs: 14, fat: 0.5 },
  { name: "Grão-de-bico cozido", category: "proteina", perPortion: "100g", calories: 164, protein: 8.9, carbs: 27, fat: 2.6 },
  // Carboidratos
  { name: "Arroz branco cozido", category: "carboidrato", perPortion: "100g", calories: 128, protein: 2.5, carbs: 28, fat: 0.3 },
  { name: "Arroz integral cozido", category: "carboidrato", perPortion: "100g", calories: 112, protein: 2.6, carbs: 23, fat: 0.9 },
  { name: "Batata-doce cozida", category: "carboidrato", perPortion: "100g", calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { name: "Batata inglesa cozida", category: "carboidrato", perPortion: "100g", calories: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { name: "Mandioca / aipim cozida", category: "carboidrato", perPortion: "100g", calories: 125, protein: 1, carbs: 30, fat: 0.3 },
  { name: "Tapioca (goma hidratada)", category: "carboidrato", perPortion: "100g", calories: 180, protein: 0.2, carbs: 44, fat: 0.1 },
  { name: "Macarrão cozido", category: "carboidrato", perPortion: "100g", calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  { name: "Aveia em flocos (seca)", category: "carboidrato", perPortion: "100g", calories: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { name: "Pão francês (1 unid ~50g)", category: "carboidrato", perPortion: "50g", calories: 134, protein: 4.3, carbs: 26, fat: 1 },
  { name: "Pão integral (1 fatia)", category: "carboidrato", perPortion: "25g", calories: 81, protein: 4, carbs: 13, fat: 1 },
  { name: "Banana (1 unid média)", category: "carboidrato", perPortion: "100g", calories: 92, protein: 1.1, carbs: 24, fat: 0.3 },
  { name: "Mamão papaia", category: "carboidrato", perPortion: "100g", calories: 39, protein: 0.6, carbs: 9.8, fat: 0.1 },
  { name: "Quinoa cozida", category: "carboidrato", perPortion: "100g", calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
  { name: "Inhame cozido", category: "carboidrato", perPortion: "100g", calories: 118, protein: 1.5, carbs: 28, fat: 0.1 },
  // Gorduras
  { name: "Azeite de oliva extra virgem", category: "gordura", perPortion: "100g", calories: 884, protein: 0, carbs: 0, fat: 100 },
  { name: "Manteiga sem sal", category: "gordura", perPortion: "100g", calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { name: "Abacate", category: "gordura", perPortion: "100g", calories: 160, protein: 2, carbs: 8.5, fat: 15 },
  { name: "Amendoim torrado sem sal", category: "gordura", perPortion: "100g", calories: 567, protein: 26, carbs: 16, fat: 49 },
  { name: "Pasta de amendoim integral", category: "gordura", perPortion: "100g", calories: 588, protein: 25, carbs: 20, fat: 50 },
  { name: "Castanha-do-pará (1 unid ~5g)", category: "gordura", perPortion: "5g", calories: 33, protein: 0.7, carbs: 0.6, fat: 3.4 },
  { name: "Castanha-de-caju", category: "gordura", perPortion: "100g", calories: 553, protein: 18, carbs: 30, fat: 44 },
  { name: "Coco ralado (seco, sem açúcar)", category: "gordura", perPortion: "100g", calories: 660, protein: 7, carbs: 24, fat: 65 },
  // Laticínios
  { name: "Queijo mussarela", category: "laticinio", perPortion: "100g", calories: 280, protein: 22, carbs: 2, fat: 20 },
  { name: "Queijo cottage light", category: "laticinio", perPortion: "100g", calories: 63, protein: 12, carbs: 3, fat: 1 },
  { name: "Leite integral", category: "laticinio", perPortion: "100ml", calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  { name: "Leite desnatado", category: "laticinio", perPortion: "100ml", calories: 34, protein: 3.4, carbs: 5, fat: 0.1 },
  // Vegetais
  { name: "Brócolis", category: "vegetal", perPortion: "100g", calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: "Couve-flor", category: "vegetal", perPortion: "100g", calories: 25, protein: 1.9, carbs: 5, fat: 0.3 },
  { name: "Espinafre", category: "vegetal", perPortion: "100g", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: "Couve (folha)", category: "vegetal", perPortion: "100g", calories: 45, protein: 3.3, carbs: 7.6, fat: 0.9 },
  { name: "Abobrinha", category: "vegetal", perPortion: "100g", calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  { name: "Tomate", category: "vegetal", perPortion: "100g", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: "Pepino", category: "vegetal", perPortion: "100g", calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { name: "Alface", category: "vegetal", perPortion: "100g", calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { name: "Cenoura", category: "vegetal", perPortion: "100g", calories: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { name: "Beterraba cozida", category: "vegetal", perPortion: "100g", calories: 44, protein: 1.7, carbs: 10, fat: 0.2 },
];

export const QUICK_ESTIMATES = [
  "Palma da mão de frango grelhado (~150g) = ~240 kcal, 48g proteína",
  "Concha de arroz branco (~200g cozido) = ~256 kcal, 56g carbo",
  "Colher de sopa de azeite (~15ml) = ~133 kcal, 15g gordura",
  "1 ovo inteiro = ~70 kcal, 6g proteína",
  "1 copo de leite integral (200ml) = ~122 kcal",
  "1 fatia de pão francês (~50g) = ~134 kcal, 26g carbo",
  "1 colher de sopa de pasta de amendoim (~30g) = ~176 kcal, 7,5g proteína",
];

// Metas de macros por objetivo (g/kg de peso corporal)
export function macroTargets(
  goal: "emagrecimento" | "hipertrofia" | "manutencao",
  weightKg: number,
) {
  const map = {
    emagrecimento: { protein: [2.0, 2.2], fat: [0.6, 0.8] },
    hipertrofia: { protein: [1.8, 2.0], fat: [0.8, 1.0] },
    manutencao: { protein: [1.6, 2.0], fat: [0.8, 0.8] },
  } as const;
  const g = map[goal];
  return {
    protein_g: [g.protein[0] * weightKg, g.protein[1] * weightKg],
    fat_g: [g.fat[0] * weightKg, g.fat[1] * weightKg],
  };
}

// Volume de treino recomendado por nível
export const TRAINING_VOLUME = {
  iniciante: { setsPerMusclePerWeek: [10, 12], repRange: [8, 12], rest: "60–90s" },
  intermediario: { setsPerMusclePerWeek: [12, 16], repRange: [6, 12], rest: "90–120s" },
  avancado: { setsPerMusclePerWeek: [16, 24], repRange: [3, 15], rest: "60–180s" },
} as const;

export type Exercise = {
  name: string;
  group: "peito" | "costas" | "ombros" | "bracos" | "pernas" | "core";
  equipment: "halteres" | "peso_corporal";
  primaryMuscles: string;
  difficulty?: "iniciante" | "intermediario" | "avancado";
  notes?: string;
};

export const EXERCISE_DB: Exercise[] = [
  // Halteres — Peito
  { name: "Supino com Halteres", group: "peito", equipment: "halteres", primaryMuscles: "Peitoral, Deltóide Anterior, Tríceps" },
  { name: "Crucifixo com Halteres", group: "peito", equipment: "halteres", primaryMuscles: "Peitoral", notes: "Peso mais leve, foco no alongamento" },
  { name: "Supino Inclinado com Halteres", group: "peito", equipment: "halteres", primaryMuscles: "Peitoral Superior" },
  { name: "Supino no Chão", group: "peito", equipment: "halteres", primaryMuscles: "Peitoral, Tríceps", notes: "Amigável para ombros" },
  // Costas
  { name: "Remada Unilateral", group: "costas", equipment: "halteres", primaryMuscles: "Latíssimo, Romboides" },
  { name: "Stiff com Halteres", group: "costas", equipment: "halteres", primaryMuscles: "Isquios, Lombar, Glúteos" },
  { name: "Pullover", group: "costas", equipment: "halteres", primaryMuscles: "Latíssimo, Peitoral" },
  // Ombros
  { name: "Desenvolvimento com Halteres", group: "ombros", equipment: "halteres", primaryMuscles: "Deltóide Anterior/Lateral" },
  { name: "Desenvolvimento Arnold", group: "ombros", equipment: "halteres", primaryMuscles: "Todas as cabeças do deltóide" },
  { name: "Elevação Lateral", group: "ombros", equipment: "halteres", primaryMuscles: "Deltóide Lateral" },
  { name: "Crucifixo Invertido", group: "ombros", equipment: "halteres", primaryMuscles: "Deltóide Posterior" },
  // Braços
  { name: "Rosca Direta", group: "bracos", equipment: "halteres", primaryMuscles: "Bíceps" },
  { name: "Rosca Martelo", group: "bracos", equipment: "halteres", primaryMuscles: "Bíceps, Braquial" },
  { name: "Tríceps Testa", group: "bracos", equipment: "halteres", primaryMuscles: "Tríceps" },
  { name: "Tríceps Coice", group: "bracos", equipment: "halteres", primaryMuscles: "Tríceps" },
  // Pernas (halteres)
  { name: "Agachamento Goblet", group: "pernas", equipment: "halteres", primaryMuscles: "Quadríceps, Glúteos" },
  { name: "Agachamento Búlgaro", group: "pernas", equipment: "halteres", primaryMuscles: "Quadríceps, Glúteos" },
  { name: "Avanço (Lunge)", group: "pernas", equipment: "halteres", primaryMuscles: "Quadríceps, Glúteos, Isquios" },
  { name: "Elevação de Panturrilha", group: "pernas", equipment: "halteres", primaryMuscles: "Panturrilha" },
  // Peso corporal
  { name: "Flexão de Braço", group: "peito", equipment: "peso_corporal", primaryMuscles: "Peitoral, Deltóide, Tríceps", difficulty: "iniciante" },
  { name: "Flexão Diamante", group: "peito", equipment: "peso_corporal", primaryMuscles: "Tríceps, Peitoral", difficulty: "intermediario" },
  { name: "Remada Invertida", group: "costas", equipment: "peso_corporal", primaryMuscles: "Costas, Bíceps", difficulty: "intermediario" },
  { name: "Superman", group: "costas", equipment: "peso_corporal", primaryMuscles: "Lombar", difficulty: "iniciante" },
  { name: "Agachamento Livre", group: "pernas", equipment: "peso_corporal", primaryMuscles: "Quadríceps, Glúteos", difficulty: "iniciante" },
  { name: "Elevação de Quadril (Glute Bridge)", group: "pernas", equipment: "peso_corporal", primaryMuscles: "Glúteos, Isquios", difficulty: "iniciante" },
  { name: "Prancha", group: "core", equipment: "peso_corporal", primaryMuscles: "Core completo", difficulty: "iniciante" },
  { name: "Prancha Lateral", group: "core", equipment: "peso_corporal", primaryMuscles: "Oblíquos", difficulty: "iniciante" },
  { name: "Mountain Climber", group: "core", equipment: "peso_corporal", primaryMuscles: "Core, Cardio", difficulty: "intermediario" },
  { name: "Elevação de Pernas", group: "core", equipment: "peso_corporal", primaryMuscles: "Abdominais Inferiores", difficulty: "intermediario" },
];

// Buscas rápidas
export function findFood(query: string): FoodItem | undefined {
  const q = query.toLowerCase().trim();
  return FOOD_DB.find((f) => f.name.toLowerCase().includes(q));
}

export function findExercises(filter: {
  group?: Exercise["group"];
  equipment?: Exercise["equipment"];
  difficulty?: Exercise["difficulty"];
}): Exercise[] {
  return EXERCISE_DB.filter((e) => {
    if (filter.group && e.group !== filter.group) return false;
    if (filter.equipment && e.equipment !== filter.equipment) return false;
    if (filter.difficulty && e.difficulty !== filter.difficulty) return false;
    return true;
  });
}

// Cálculo de volume de treino (traduzido de log-workout.py)
export function calcWorkoutVolume(weightKg: number, reps: number[]): number {
  return weightKg * reps.reduce((a, b) => a + b, 0);
}

// Resumo de macros diários (traduzido de calculate-macros.py)
export type MealEntry = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  skipped?: boolean;
  meal_type?: string;
};
export function summarizeDailyMacros(meals: MealEntry[]) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const skipped: string[] = [];
  for (const m of meals) {
    if (m.skipped) {
      if (m.meal_type) skipped.push(m.meal_type);
      continue;
    }
    totals.calories += m.calories;
    totals.protein += m.protein;
    totals.carbs += m.carbs;
    totals.fat += m.fat;
  }
  return { totals, skipped };
}

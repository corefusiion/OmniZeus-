/**
 * Parsers client-side para importar atividades de arquivos exportados pelo
 * usuário. Sem API, sem dependência de plano pago.
 *
 * Fontes suportadas:
 * - Apple Health: export.xml (Saúde → Perfil → Exportar dados de saúde)
 * - Google Fit / Health Connect: sessions/activities.json (Google Takeout)
 * - Strava export: activities.csv (Configurações → Meus dados → Solicitar arquivo)
 *
 * Retorna atividades normalizadas: tipo, data, duração em minutos, distância.
 */

export type ImportedActivity = {
  id: string;
  source: "apple_health" | "google_fit" | "strava_csv";
  kind: string; // rótulo original ("Corrida", "Running", "Ride"…)
  startedAt: string; // ISO
  durationMin: number;
  distanceKm: number | null;
  calories: number | null;
};

const APPLE_KIND_MAP: Record<string, string> = {
  HKWorkoutActivityTypeRunning: "Corrida",
  HKWorkoutActivityTypeWalking: "Caminhada",
  HKWorkoutActivityTypeCycling: "Ciclismo",
  HKWorkoutActivityTypeSwimming: "Natação",
  HKWorkoutActivityTypeYoga: "Yoga",
  HKWorkoutActivityTypeFunctionalStrengthTraining: "Musculação",
  HKWorkoutActivityTypeTraditionalStrengthTraining: "Musculação",
  HKWorkoutActivityTypeHighIntensityIntervalTraining: "HIIT",
  HKWorkoutActivityTypeElliptical: "Elíptico",
  HKWorkoutActivityTypeRowing: "Remo",
  HKWorkoutActivityTypeCoreTraining: "Core",
  HKWorkoutActivityTypeDance: "Dança",
  HKWorkoutActivityTypeHiking: "Trilha",
};

function humanize(raw: string): string {
  return APPLE_KIND_MAP[raw] ?? raw.replace(/^HKWorkoutActivityType/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** Parse do export.xml do Apple Health. Extrai apenas <Workout> tags. */
export function parseAppleHealthXml(xml: string): ImportedActivity[] {
  const out: ImportedActivity[] = [];
  // Usa regex em vez de DOMParser (arquivos podem ter 100MB+ e o XML é simples).
  const re = /<Workout\s+([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    const get = (k: string) => {
      const r = new RegExp(`${k}="([^"]*)"`).exec(attrs);
      return r ? r[1] : null;
    };
    const type = get("workoutActivityType");
    const startedAt = get("startDate");
    const durationRaw = get("duration");
    const unit = get("durationUnit") ?? "min";
    const distanceRaw = get("totalDistance");
    const distUnit = get("totalDistanceUnit") ?? "km";
    const kcalRaw = get("totalEnergyBurned");
    if (!type || !startedAt || !durationRaw) continue;
    const dur = Number(durationRaw);
    const durationMin = unit === "s" ? dur / 60 : unit === "h" ? dur * 60 : dur;
    let distanceKm: number | null = null;
    if (distanceRaw) {
      const d = Number(distanceRaw);
      distanceKm = distUnit === "mi" ? d * 1.60934 : distUnit === "m" ? d / 1000 : d;
    }
    out.push({
      id: `apple-${i++}-${startedAt}`,
      source: "apple_health",
      kind: humanize(type),
      startedAt: new Date(startedAt.replace(" ", "T")).toISOString(),
      durationMin: Math.round(durationMin),
      distanceKm: distanceKm ? Math.round(distanceKm * 100) / 100 : null,
      calories: kcalRaw ? Math.round(Number(kcalRaw)) : null,
    });
  }
  return out;
}

/** Parse do JSON de sessões do Google Fit / Health Connect (Takeout). */
export function parseGoogleFitJson(json: string): ImportedActivity[] {
  const data = JSON.parse(json);
  // Formato Takeout: { "Data Sources": [...], "sessions": [{ startTimeMillis, endTimeMillis, name, activityType, ... }] }
  const sessions: any[] = Array.isArray(data)
    ? data
    : (data.sessions ?? data.Sessions ?? data.session ?? []);
  return sessions
    .map((s, i): ImportedActivity | null => {
      const start = Number(s.startTimeMillis ?? s.start_time_millis ?? s.startTime);
      const end = Number(s.endTimeMillis ?? s.end_time_millis ?? s.endTime);
      if (!start || !end) return null;
      const durationMin = Math.round((end - start) / 60000);
      if (durationMin <= 0) return null;
      return {
        id: `gfit-${i}-${start}`,
        source: "google_fit",
        kind: String(s.name ?? s.activityType ?? "Atividade"),
        startedAt: new Date(start).toISOString(),
        durationMin,
        distanceKm: null,
        calories: null,
      };
    })
    .filter((x): x is ImportedActivity => x !== null);
}

/** Parse do activities.csv do Strava export (grátis pra qualquer conta). */
export function parseStravaCsv(csv: string): ImportedActivity[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  // CSV simples: primeira linha é header. Split naïve serve pro export do Strava
  // (campos com vírgula vêm entre aspas — tratamos).
  const parseRow = (row: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (const ch of row) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const header = parseRow(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const iDate = idx("date");
  const iType = idx("type");
  const iName = idx("name");
  const iDur = idx("elapsed time"); // segundos
  const iDist = idx("distance");
  if (iDate < 0 || iDur < 0) return [];
  return lines.slice(1).map((row, i): ImportedActivity | null => {
    const cols = parseRow(row);
    const date = cols[iDate];
    if (!date) return null;
    const durSec = Number(cols[iDur]);
    if (!durSec || durSec <= 0) return null;
    const dist = iDist >= 0 ? Number(cols[iDist]) : NaN;
    return {
      id: `strava-${i}-${date}`,
      source: "strava_csv",
      kind: (iType >= 0 && cols[iType]) || (iName >= 0 && cols[iName]) || "Atividade",
      startedAt: new Date(date).toISOString(),
      durationMin: Math.round(durSec / 60),
      distanceKm: Number.isFinite(dist) && dist > 0 ? Math.round(dist * 100) / 100 : null,
      calories: null,
    };
  }).filter((x): x is ImportedActivity => x !== null);
}

/** Auto-detecta o formato pelo nome/conteúdo do arquivo. */
export async function parseActivityFile(file: File): Promise<ImportedActivity[]> {
  const name = file.name.toLowerCase();
  const text = await file.text();
  if (name.endsWith(".xml") || text.trimStart().startsWith("<?xml")) {
    return parseAppleHealthXml(text);
  }
  if (name.endsWith(".json")) return parseGoogleFitJson(text);
  if (name.endsWith(".csv")) return parseStravaCsv(text);
  // fallback: tenta os três
  try { return parseGoogleFitJson(text); } catch { /* noop */ }
  if (text.includes("<Workout")) return parseAppleHealthXml(text);
  return parseStravaCsv(text);
}

/**
 * Sugere o exercise_type do desafio que melhor casa com o rótulo importado.
 * Match por keyword no nome do tipo de exercício cadastrado.
 */
export function guessExerciseTypeId(
  activityKind: string,
  exerciseTypes: { id: string; name: string }[],
): string | null {
  const k = activityKind.toLowerCase();
  const findBy = (needles: string[]) =>
    exerciseTypes.find((t) => needles.some((n) => t.name.toLowerCase().includes(n)))?.id ?? null;
  if (/(run|corr)/.test(k)) return findBy(["corr", "run"]);
  if (/(walk|caminh)/.test(k)) return findBy(["caminh", "walk"]);
  if (/(cycl|bike|ride|ciclis)/.test(k)) return findBy(["bike", "ciclis", "pedal"]);
  if (/(swim|nata)/.test(k)) return findBy(["nata", "swim"]);
  if (/(yoga|pilates|stretch)/.test(k)) return findBy(["yoga", "pilates", "alonga"]);
  if (/(strength|weight|muscul)/.test(k)) return findBy(["muscul", "força", "forca", "weight"]);
  if (/(hiit|interval)/.test(k)) return findBy(["hiit", "func"]);
  return null;
}

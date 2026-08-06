// Shared status label for challenge cards (Explorar, Meus Desafios).
// Uses local dates (YYYY-MM-DD) to compare with today, avoiding TZ drift.

export type ChallengeStatus =
  | { kind: "upcoming"; days: number; label: string }
  | { kind: "ongoing"; days: number; label: string }
  | { kind: "finished"; label: string };

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(fromISO: string, toISO: string): number {
  // Both are YYYY-MM-DD; parse as UTC midnight to keep diff stable.
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  return Math.max(0, Math.ceil((b - a) / 86400000));
}

export function getChallengeStatus(startsAt: string, endsAt: string): ChallengeStatus {
  const today = todayLocalISO();
  if (today < startsAt) {
    const days = diffDays(today, startsAt);
    return { kind: "upcoming", days, label: `⏳ Começa em ${days} ${days === 1 ? "dia" : "dias"}` };
  }
  if (today > endsAt) {
    return { kind: "finished", label: "🏁 Finalizado" };
  }
  const days = diffDays(today, endsAt);
  return {
    kind: "ongoing",
    days,
    label: `🔥 ${days} ${days === 1 ? "dia restante" : "dias restantes"}`,
  };
}

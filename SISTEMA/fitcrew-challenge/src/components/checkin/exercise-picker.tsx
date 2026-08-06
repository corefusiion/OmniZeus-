import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { listExercisePresets } from "@/lib/exercise-presets.functions";
import { supabase } from "@/integrations/supabase/client";

type ExerciseType = {
  id: string;
  name: string;
  icon: string | null;
  points: number;
  min_minutes: number;
};

export function ExercisePickerGrouped({
  exercises,
  value,
  onSelect,
  userId,
  challengeId,
}: {
  exercises: ExerciseType[];
  value: string;
  onSelect: (t: ExerciseType) => void;
  userId: string | null;
  challengeId: string;
}) {
  const [search, setSearch] = useState("");
  const listFn = useServerFn(listExercisePresets);

  const { data: presets } = useQuery({
    queryKey: ["exercise-presets"],
    queryFn: () => listFn(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: favoriteIds } = useQuery({
    queryKey: ["exercise-favorites", userId, challengeId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("checkins")
        .select("exercise_type_id")
        .eq("user_id", userId!)
        .eq("challenge_id", challengeId)
        .gte("occurred_on", since)
        .limit(200);
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        counts.set(r.exercise_type_id, (counts.get(r.exercise_type_id) ?? 0) + 1);
      });
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
    },
  });

  const categoryByName = useMemo(() => {
    const map = new Map<string, string>();
    (presets ?? []).forEach((p) => map.set(p.name.trim().toLowerCase(), p.category));
    return map;
  }, [presets]);

  const q = search.trim().toLowerCase();
  const matching = exercises.filter((e) => !q || e.name.toLowerCase().includes(q));

  const favorites = useMemo(() => {
    if (!favoriteIds || favoriteIds.length === 0) return [];
    return favoriteIds
      .map((id) => matching.find((e) => e.id === id))
      .filter((e): e is ExerciseType => !!e);
  }, [favoriteIds, matching]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExerciseType[]>();
    matching.forEach((e) => {
      const cat = categoryByName.get(e.name.trim().toLowerCase()) ?? "Outros";
      const arr = map.get(cat) ?? [];
      arr.push(e);
      map.set(cat, arr);
    });
    const preferredOrder = [
      "Musculação",
      "Corrida",
      "Ciclismo",
      "Caminhada",
      "Cardio",
      "Funcional",
      "Mente e Corpo",
      "Core",
      "Aeróbica",
      "Artes Marciais",
      "Esportes em Equipe",
      "Recreativo",
      "Trilha",
      "Escalada",
      "Água",
      "Outros",
    ];
    return Array.from(map.entries()).sort(
      (a, b) => preferredOrder.indexOf(a[0]) - preferredOrder.indexOf(b[0]),
    );
  }, [matching, categoryByName]);

  const renderChip = (t: ExerciseType) => {
    const active = t.id === value;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onSelect(t)}
        className={`flex min-w-0 flex-col items-start gap-0.5 rounded-xl border p-2 text-left transition ${
          active
            ? "border-primary bg-primary/5 shadow-flame"
            : "border-border bg-card hover:border-primary/50"
        }`}
      >
        <span className="text-lg leading-none">{t.icon ?? "🏅"}</span>
        <span className="line-clamp-1 w-full font-display text-[13px] font-bold leading-tight">
          {t.name}
        </span>
        <span className="w-full truncate text-[10px] text-muted-foreground">
          +{t.points} · {t.min_minutes}min
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício..."
          className="pl-9"
        />
      </div>

      {favorites.length > 0 && !q ? (
        <div>
          <h4 className="mb-1.5 text-xs font-display font-bold uppercase tracking-wide text-muted-foreground">
            Favoritos
          </h4>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {favorites.map(renderChip)}
          </div>
        </div>
      ) : null}

      {grouped.map(([cat, items]) => (
        <div key={cat}>
          <h4 className="mb-1.5 text-xs font-display font-bold uppercase tracking-wide text-muted-foreground">
            {cat}
          </h4>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">{items.map(renderChip)}</div>
        </div>
      ))}

      {matching.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum exercício encontrado.
        </p>
      ) : null}
    </div>
  );
}

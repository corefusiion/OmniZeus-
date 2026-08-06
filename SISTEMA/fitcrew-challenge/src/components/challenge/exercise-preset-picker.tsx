import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  listExercisePresets,
  addPresetsToChallenge,
  type ExercisePreset,
} from "@/lib/exercise-presets.functions";

export function ExercisePresetPicker({
  challengeId,
  existingNames,
  onAdded,
}: {
  challengeId: string;
  existingNames: string[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const listFn = useServerFn(listExercisePresets);
  const addFn = useServerFn(addPresetsToChallenge);

  const { data: presets, isLoading } = useQuery({
    queryKey: ["exercise-presets"],
    queryFn: () => listFn(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const existingSet = useMemo(
    () => new Set(existingNames.map((n) => n.trim().toLowerCase())),
    [existingNames],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    (presets ?? []).forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [presets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (presets ?? []).filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });
  }, [presets, search, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExercisePreset[]>();
    filtered.forEach((p) => {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await addFn({ data: { challengeId, slugs: Array.from(selected) } });
      toast.success(
        res.inserted > 0
          ? `${res.inserted} exercício${res.inserted > 1 ? "s" : ""} adicionado${res.inserted > 1 ? "s" : ""}.`
          : "Nada a adicionar (já cadastrados).",
      );
      setSelected(new Set());
      setOpen(false);
      onAdded();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao adicionar exercícios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar da biblioteca
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-0 sm:h-auto sm:max-h-[85vh]">
        <DialogHeader className="shrink-0 border-b border-border p-4">
          <DialogTitle>Biblioteca de atividades</DialogTitle>
          <DialogDescription>
            Escolha as modalidades que fazem parte deste desafio. Pontos e duração mínima vêm sugeridos
            e você pode editar depois em cada linha.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atividade..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                category === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  category === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma atividade encontrada.
            </p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-sm font-display font-bold uppercase tracking-wide text-muted-foreground">
                    {cat}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((p) => {
                      const already = existingSet.has(p.name.trim().toLowerCase());
                      const checked = selected.has(p.slug);
                      return (
                        <label
                          key={p.slug}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                            already
                              ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
                              : checked
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          <Checkbox
                            checked={already || checked}
                            disabled={already}
                            onCheckedChange={() => !already && toggle(p.slug)}
                          />
                          <span className="text-2xl leading-none">{p.icon ?? "🏅"}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              +{p.suggested_points} pts · mín {p.suggested_min_minutes}min
                            </p>
                          </div>
                          {already ? (
                            <Badge variant="secondary" className="text-[10px]">
                              já adicionado
                            </Badge>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-row flex-wrap items-center gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mr-auto text-xs text-muted-foreground">
            {selected.size} selecionado{selected.size === 1 ? "" : "s"}
          </p>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={saving || selected.size === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Adicionar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

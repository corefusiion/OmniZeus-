import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, ImageIcon, Loader2, ShieldAlert, Sun } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { createCheckinBatch, propagatePhotoDecision } from "@/lib/checkins.functions";
import { reverseGeocode } from "@/lib/geocoding.functions";
import { analyzeAndCommentCheckin } from "@/lib/coach.functions";
import { fetchChallengeById, uploadCheckinPhoto } from "@/lib/checkins.queries";
import { getMyChallenges } from "@/lib/challenges.functions";
import { getDailyPoses } from "@/lib/daily-poses.functions";
import { DAILY_POSES } from "@/lib/daily-poses";
import { readPhotoMeta, type PhotoSource } from "@/lib/photo-exif";
import { ActivityImporter, StravaComingSoon } from "@/components/checkin/activity-importer";
import { ExercisePickerGrouped } from "@/components/checkin/exercise-picker";
import type { ImportedActivity } from "@/lib/activity-import";
import { guessExerciseTypeId } from "@/lib/activity-import";
import { MapPin, X, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/checkin")({
  component: CheckinPage,
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const LS_KEY = "fitcrew:last-checkin-challenges"; // array de IDs

type Selection = { checked: boolean; exerciseTypeId: string };

function CheckinPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createBatchFn = useServerFn(createCheckinBatch);
  const coachFn = useServerFn(analyzeAndCommentCheckin);
  const propagateFn = useServerFn(propagatePhotoDecision);
  const myChallengesFn = useServerFn(getMyChallenges);
  const reverseGeocodeFn = useServerFn(reverseGeocode);
  const getDailyPosesFn = useServerFn(getDailyPoses);

  // Estado: pose escolhida por desafio (usuário "madrugador") ou marcado (seguidor).
  const [poseChoice, setPoseChoice] = useState<Record<string, string>>({}); // challengeId -> poseKey (madrugador)
  const [poseUsed, setPoseUsed] = useState<Record<string, boolean>>({}); // challengeId -> "fiz a pose"

  const { data: myChallenges, isLoading: loadingList } = useQuery({
    queryKey: ["my-challenges"],
    queryFn: () => myChallengesFn(),
  });

  type ChallengeOpt = { id: string; name: string; role: string };
  const activeList: ChallengeOpt[] = useMemo(
    () =>
      ((myChallenges ?? []) as any[])
        .filter((m: any) => m.challenge?.is_active)
        .map((m: any) => ({
          id: m.challenge.id as string,
          name: m.challenge.name as string,
          role: m.role as string,
        })),
    [myChallenges],
  );

  // Hidrata todos os desafios ativos em paralelo (exercícios + regras).
  const challengeQueries = useQueries({
    queries: activeList.map((c) => ({
      queryKey: ["challenge-by-id", c.id],
      queryFn: () => fetchChallengeById(c.id),
      enabled: !!c.id,
    })),
  });

  const challengeById = useMemo(() => {
    const map = new Map<string, NonNullable<Awaited<ReturnType<typeof fetchChallengeById>>>>();
    challengeQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [challengeQueries]);

  const hydrating = challengeQueries.some((q) => q.isLoading);

  const [selections, setSelections] = useState<Record<string, Selection>>({});

  // Inicializa: usa último uso do LS, senão marca o primeiro desafio.
  useEffect(() => {
    if (!activeList.length) return;
    if (Object.keys(selections).length) return;
    const saved =
      typeof window !== "undefined"
        ? (JSON.parse(window.localStorage.getItem(LS_KEY) ?? "[]") as string[])
        : [];
    const savedFiltered = saved.filter((id) => activeList.some((c) => c.id === id));
    const initialIds = savedFiltered.length ? savedFiltered : [activeList[0].id];
    const next: Record<string, Selection> = {};
    activeList.forEach((c) => {
      next[c.id] = { checked: initialIds.includes(c.id), exerciseTypeId: "" };
    });
    setSelections(next);
  }, [activeList, selections]);

  // Persiste seleção
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ids = Object.entries(selections)
      .filter(([, s]) => s.checked)
      .map(([id]) => id);
    if (ids.length) window.localStorage.setItem(LS_KEY, JSON.stringify(ids));
  }, [selections]);

  const checkedIds = useMemo(
    () => Object.entries(selections).filter(([, s]) => s.checked).map(([id]) => id),
    [selections],
  );

  const toggleChallenge = (id: string) =>
    setSelections((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { exerciseTypeId: "" }), checked: !prev[id]?.checked },
    }));

  const setExerciseFor = (id: string, exerciseTypeId: string) =>
    setSelections((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { checked: true, exerciseTypeId: "" }), exerciseTypeId },
    }));

  const markAll = (checked: boolean) =>
    setSelections((prev) => {
      const next: Record<string, Selection> = { ...prev };
      activeList.forEach((c) => {
        next[c.id] = { ...(next[c.id] ?? { exerciseTypeId: "" }), checked };
      });
      return next;
    });

  // Contagem semanal por desafio marcado
  const weekQueries = useQueries({
    queries: checkedIds.map((cid) => {
      const ch = challengeById.get(cid);
      return {
        queryKey: ["week-count", cid],
        enabled: !!ch,
        queryFn: async () => {
          const { data: userData } = await supabase.auth.getUser();
          if (!userData.user || !ch) return null;
          const now = new Date();
          const day = now.getUTCDay();
          const diffToMonday = (day + 6) % 7;
          const ws = new Date(now);
          ws.setUTCDate(now.getUTCDate() - diffToMonday);
          const we = new Date(ws);
          we.setUTCDate(ws.getUTCDate() + 6);
          const iso = (d: Date) => d.toISOString().slice(0, 10);
          const { data } = await supabase
            .from("checkins")
            .select("occurred_on, over_limit")
            .eq("user_id", userData.user.id)
            .eq("challenge_id", ch.id)
            .gte("occurred_on", iso(ws))
            .lte("occurred_on", iso(we));
          const days = new Set((data ?? []).filter((r) => !r.over_limit).map((r) => r.occurred_on));
          return { challengeId: ch.id, name: ch.name, counted: days.size, max: ch.max_days_per_week };
        },
      };
    }),
  });

  const weekInfos = weekQueries
    .map((q) => q.data)
    .filter(Boolean) as Array<{ challengeId: string; name: string; counted: number; max: number }>;

  const [durationMin, setDurationMin] = useState<number>(30);
  const [occurredOn, setOccurredOn] = useState<string>(todayISO());

  // Query da pose do dia para os desafios marcados.
  const dailyPosesQuery = useQuery({
    queryKey: ["daily-poses", checkedIds.sort().join(","), occurredOn],
    enabled: checkedIds.length > 0,
    queryFn: () =>
      getDailyPosesFn({ data: { challengeIds: checkedIds, date: occurredOn } }),
  });
  const posesByChallenge = useMemo(() => {
    const map = new Map<string, NonNullable<typeof dailyPosesQuery.data>[number]>();
    (dailyPosesQuery.data ?? []).forEach((p) => map.set(p.challenge_id, p));
    return map;
  }, [dailyPosesQuery.data]);

  const [startedAtLocal, setStartedAtLocal] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<PhotoSource>("unknown");
  const [photoTakenAt, setPhotoTakenAt] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [photoHardBlock, setPhotoHardBlock] = useState<string | null>(null);
  const [source, setSource] = useState<"manual" | "strava" | "health">("manual");
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<"nominatim" | "manual" | "mixed" | null>(null);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não tem GPS.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng, accuracy: pos.coords.accuracy });
        setLocating(false);
        toast.success("Localização adicionada.");
        setResolvingPlace(true);
        try {
          const out = await reverseGeocodeFn({ data: { lat, lng } });
          if (out?.name) {
            setLocationName(out.name);
            setLocationAddress(out.address);
            setLocationSource("nominatim");
          }
        } catch {
          /* silencioso */
        } finally {
          setResolvingPlace(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error("Não deu pra pegar sua localização.", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // Duração mínima é o MAIOR mínimo entre exercícios marcados (para não bloquear ninguém).
  const effectiveMinMinutes = useMemo(() => {
    let min = 1;
    let worstChallenge: string | null = null;
    checkedIds.forEach((cid) => {
      const ch = challengeById.get(cid);
      const sel = selections[cid];
      if (!ch || !sel?.exerciseTypeId) return;
      const ex = ch.exercise_types.find((t) => t.id === sel.exerciseTypeId);
      if (ex && ex.min_minutes > min) {
        min = ex.min_minutes;
        worstChallenge = ch.name;
      }
    });
    return { min, worstChallenge };
  }, [checkedIds, selections, challengeById]);

  // Janela de datas: interseção de [starts_at, ends_at] dos desafios marcados.
  const dateWindow = useMemo(() => {
    let start = "";
    let end = "";
    checkedIds.forEach((cid) => {
      const ch = challengeById.get(cid);
      if (!ch) return;
      if (!start || ch.starts_at > start) start = ch.starts_at;
      if (!end || ch.ends_at < end) end = ch.ends_at;
    });
    return { start, end };
  }, [checkedIds, challengeById]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!checkedIds.length) throw new Error("Selecione ao menos um desafio.");
      const missing = checkedIds.find((cid) => !selections[cid]?.exerciseTypeId);
      if (missing) {
        const ch = challengeById.get(missing);
        throw new Error(`Escolha o exercício para "${ch?.name ?? "desafio"}".`);
      }
      if (source === "manual" && !file) throw new Error("A foto do dia é obrigatória.");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sessão expirada.");
      const photoPath = file ? await uploadCheckinPhoto(userData.user.id, file) : null;
      const entries = checkedIds.map((cid) => {
        const existingPose = posesByChallenge.get(cid);
        const chosen = !existingPose ? poseChoice[cid] ?? null : null;
        const usedFollower = !!existingPose && !!poseUsed[cid];
        return {
          challengeId: cid,
          exerciseTypeId: selections[cid]!.exerciseTypeId,
          usedDailyPose: usedFollower || !!chosen,
          chosenPoseKey: chosen,
        };
      });
      return await createBatchFn({
        data: {
          entries,
          occurredOn,
          durationMin,
          photoPath,
          caption: caption.trim() || null,
          source,
          photoSource,
          photoTakenAt,
          startedAtLocal: startedAtLocal || null,
          locationLat: location?.lat ?? null,
          locationLng: location?.lng ?? null,
          locationAccuracyM: location?.accuracy ?? null,
          locationName: locationName.trim() || null,
          locationAddress: locationAddress,
          locationSource: locationName.trim() ? locationSource ?? "manual" : null,
        },
      });
    },
    onSuccess: async (res) => {
      const results = res.results ?? [];
      const ok = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      const totalPoints = ok.reduce((a, r) => a + (r.pointsAwarded ?? 0), 0);
      const overLimit = ok.filter((r) => r.overLimit);
      const flagged = ok.filter((r) => r.photoFlagged);

      if (ok.length) {
        toast.success(
          ok.length === 1
            ? `+${totalPoints} pontos! 💪`
            : `Check-in em ${ok.length} desafios · +${totalPoints} pontos totais 💪`,
          {
            description:
              ok.length > 1
                ? ok.map((r) => `${r.challengeName}: +${r.pointsAwarded}${r.overLimit ? " (fora do limite)" : ""}`).join(" · ")
                : undefined,
          },
        );
      }
      if (overLimit.length && ok.length === 1) {
        toast.warning("Fora do limite semanal — 0 pontos neste desafio.");
      }
      if (flagged.length) {
        toast.warning(`Foto marcada para revisão em ${flagged.length} desafio(s)`, {
          description: flagged[0].photoFlagReason ?? undefined,
        });
      }
      failed.forEach((f) => {
        const name = challengeById.get(f.challengeId)?.name ?? "Desafio";
        toast.error(`${name}: ${f.error}`);
      });

      // Coach analisa a foto UMA vez sobre o primeiro check-in, depois propaga a decisão.
      const first = ok[0];
      if (first?.id) {
        const analyzing = toast.loading("Coach analisando sua foto…", { duration: 30000 });
        try {
          const out = await coachFn({ data: { checkinId: first.id } });
          toast.dismiss(analyzing);
          if (out?.ok && out.validated) {
            if (ok.length > 1) {
              await propagateFn({ data: { checkinId: first.id, decision: out.validated as any } });
            }
            if (out.validated === "rejected") {
              toast.error("Foto rejeitada pela IA", {
                description: "A imagem não parece ser um treino. Check-in sem pontos.",
              });
            } else if (out.validated === "needs_review") {
              toast.warning("Check-in em revisão", {
                description: "A IA sinalizou pro admin dar uma olhada.",
              });
            }
          }
        } catch {
          toast.dismiss(analyzing);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["week-count"] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats"] });
      navigate({ to: "/feed" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (loadingList || (hydrating && activeList.length > 0)) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!activeList.length) {
    return (
      <>
        <SectionHeader title="Fazer check-in" />
        <div className="mx-auto max-w-lg rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-8 shadow-flame">
          <div className="text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/20 text-2xl">
              🏋️
            </div>
            <h2 className="mt-4 font-display text-xl font-bold">
              Entra num desafio primeiro
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você precisa estar em um desafio para registrar um treino. Explore os desafios disponíveis ou entre com um código de convite.
            </p>
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button asChild className="rounded-full shadow-flame">
              <Link to="/explore">Ir para Explorar</Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                const code = window.prompt("Cole o código de convite do desafio:");
                if (code && code.trim()) {
                  window.location.href = `/join/${code.trim().toUpperCase()}`;
                }
              }}
            >
              Tenho um código
            </Button>
          </div>
        </div>
      </>
    );
  }

  const onFile = async (f: File | null, hint: PhotoSource) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setPhotoSource(hint);
    setPhotoWarning(null);
    setPhotoHardBlock(null);
    setPhotoTakenAt(null);
    if (!f) return;
    try {
      const meta = await readPhotoMeta(f, hint);
      setPhotoTakenAt(meta.takenAt);
      if (meta.takenAt) {
        const diffH = (Date.now() - new Date(meta.takenAt).getTime()) / 36e5;
        if (diffH > 24) {
          setPhotoWarning(`Foto tirada há ${Math.round(diffH)}h — pode ser marcada para revisão.`);
        }
      }
    } catch {
      /* ignora falha de EXIF */
    }
  };

  return (
    <>
      <SectionHeader
        title="Fazer check-in"
        subtitle={
          checkedIds.length
            ? `${checkedIds.length} desafio${checkedIds.length > 1 ? "s" : ""} · duração mín ${effectiveMinMinutes.min}min`
            : "Selecione ao menos um desafio"
        }
      />

      {/* Seletor de desafios (multi) */}
      <div className="mb-6 rounded-3xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-sm font-medium">
            Postar check-in em {activeList.length > 1 ? "quais desafios" : "qual desafio"}?
          </Label>
          {activeList.length > 1 && (
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => markAll(true)}
                className="rounded-full border border-border px-3 py-1 hover:border-primary/50"
              >
                Marcar todos
              </button>
              <button
                type="button"
                onClick={() => markAll(false)}
                className="rounded-full border border-border px-3 py-1 hover:border-primary/50"
              >
                Limpar
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {activeList.map((c) => {
            const sel = selections[c.id];
            const ch = challengeById.get(c.id);
            const checked = !!sel?.checked;
            return (
              <div
                key={c.id}
                className={`rounded-2xl border p-3 transition ${
                  checked ? "border-primary bg-primary/5" : "border-border bg-background"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleChallenge(c.id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                  <span className="flex-1 font-semibold">{c.name}</span>
                  {(c.role === "owner" || c.role === "co_admin") && (
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {c.role === "owner" ? "dono" : "co-admin"}
                    </span>
                  )}
                </button>

                {checked && ch && (
                  <div className="mt-3 border-t border-border pt-3">
                    <Label className="mb-2 block text-xs font-medium text-muted-foreground">
                      Exercício em {ch.name}
                    </Label>
                    <ExercisePickerGrouped
                      exercises={ch.exercise_types}
                      value={sel?.exerciseTypeId ?? ""}
                      userId={userId}
                      challengeId={ch.id}
                      onSelect={(t) => {
                        setExerciseFor(c.id, t.id);
                        if (durationMin < t.min_minutes) setDurationMin(t.min_minutes);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pose do Dia */}
      {checkedIds.length > 0 && !dailyPosesQuery.isLoading && (
        <div className="mb-6 space-y-3">
          {checkedIds.map((cid) => {
            const ch = challengeById.get(cid);
            if (!ch) return null;
            const existing = posesByChallenge.get(cid);
            const chosen = poseChoice[cid];
            if (existing) {
              const used = !!poseUsed[cid];
              return (
                <div
                  key={cid}
                  className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    📸 Pose do Dia · {ch.name}
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-2xl">{existing.pose_emoji}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{existing.pose_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Escolhida por @{existing.chosen_by_username ?? existing.chosen_by_name ?? "alguém"}
                      </p>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background p-2 text-sm">
                    <input
                      type="checkbox"
                      checked={used}
                      onChange={(e) => setPoseUsed((prev) => ({ ...prev, [cid]: e.target.checked }))}
                      className="size-4 accent-primary"
                    />
                    <span className="flex-1">
                      Fiz a pose do dia <span className="text-xs text-muted-foreground">(vantagem no desempate)</span>
                    </span>
                  </label>
                </div>
              );
            }
            // Madrugador: primeiro do dia
            return (
              <div
                key={cid}
                className="rounded-2xl border border-amber-300/60 bg-gradient-to-br from-amber-100/60 to-amber-50/40 p-4 dark:from-amber-500/10 dark:to-amber-500/5"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <Sun className="size-4 text-amber-600" />
                  Você é o primeiro em {ch.name}!
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Escolha a Pose do Dia — o resto do grupo vai copiar. Garante vantagem em critério de desempate.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DAILY_POSES.map((p) => {
                    const active = chosen === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() =>
                          setPoseChoice((prev) => ({
                            ...prev,
                            [cid]: prev[cid] === p.key ? "" : p.key,
                          }))
                        }
                        className={`rounded-xl border p-2 text-left text-xs transition ${
                          active
                            ? "border-primary bg-primary/10 shadow-flame"
                            : "border-border bg-background hover:border-primary/50"
                        }`}
                      >
                        <div className="text-2xl">{p.emoji}</div>
                        <div className="mt-1 line-clamp-2 font-medium leading-tight">{p.name}</div>
                      </button>
                    );
                  })}
                </div>
                {!chosen && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Opcional. Se pular, ninguém pontua a pose hoje.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Progresso semanal por desafio marcado */}
      {weekInfos.length > 0 && (
        <div className="mb-6 space-y-2">
          {weekInfos.map((w) => {
            const full = w.counted >= w.max;
            return (
              <div
                key={w.challengeId}
                className={`flex items-center justify-between rounded-2xl border p-3 ${
                  full ? "border-amber-300/60 bg-amber-50 text-amber-900" : "border-border bg-card"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.counted}/{w.max} dias contando essa semana
                    {full && " · limite atingido, novo check-in não pontua"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {Array.from({ length: w.max }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-6 w-1.5 rounded-full ${i < w.counted ? "bg-primary" : "bg-secondary"}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <Label className="mb-3 block text-sm font-medium">Origem do check-in</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "manual", label: "Manual + foto", emoji: "📸" },
                { id: "health", label: "Apple Health / Google Fit", emoji: "⌚" },
                { id: "strava", label: "Strava", emoji: "🏃" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className={`rounded-2xl border p-3 text-left text-xs transition ${
                  source === s.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="text-lg">{s.emoji}</div>
                <div className="mt-1 font-semibold">{s.label}</div>
              </button>
            ))}
          </div>
          {source === "health" && checkedIds.length === 1 && (() => {
            const cid = checkedIds[0];
            const ch = challengeById.get(cid);
            if (!ch) return null;
            return (
              <div className="mt-3">
                <ActivityImporter
                  onPick={(a: ImportedActivity) => {
                    const guess = guessExerciseTypeId(a.kind, ch.exercise_types);
                    if (guess) setExerciseFor(cid, guess);
                    const min = ch.exercise_types.find((t) => t.id === (guess ?? selections[cid]?.exerciseTypeId))?.min_minutes ?? 30;
                    setDurationMin(Math.max(min, a.durationMin));
                    setOccurredOn(a.startedAt.slice(0, 10));
                    const parts = [
                      a.kind,
                      a.distanceKm ? `${a.distanceKm}km` : null,
                      a.calories ? `${a.calories}kcal` : null,
                    ].filter(Boolean).join(" · ");
                    setCaption((prev) => prev || `Importado: ${parts}`);
                    toast.success("Atividade carregada — confira e bata o ponto.");
                  }}
                />
              </div>
            );
          })()}
          {source === "health" && checkedIds.length !== 1 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Importação do smartwatch só está disponível quando um único desafio está marcado.
            </p>
          )}
          {source === "strava" && (
            <div className="mt-3">
              <StravaComingSoon />
            </div>
          )}
          {source !== "manual" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Importando do smartwatch: a foto fica opcional. Preencha duração e tipo pelo app do relógio ou manualmente.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="duration" className="mb-2 block text-sm font-medium">
              Duração (min)
            </Label>
            <Input
              id="duration"
              type="number"
              inputMode="numeric"
              min={effectiveMinMinutes.min}
              max={600}
              value={Number.isFinite(durationMin) && durationMin > 0 ? String(durationMin) : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/^0+(?=\d)/, "");
                setDurationMin(raw === "" ? 0 : Number(raw));
              }}
              onBlur={() => {
                if (!durationMin || durationMin < effectiveMinMinutes.min) setDurationMin(effectiveMinMinutes.min);
              }}
              required
            />
            {effectiveMinMinutes.worstChallenge && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mínimo {effectiveMinMinutes.min}min (exigido por {effectiveMinMinutes.worstChallenge}).
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="date" className="mb-2 block text-sm font-medium">
              Data
            </Label>
            <Input
              id="date"
              type="date"
              value={occurredOn}
              min={dateWindow.start || undefined}
              max={dateWindow.end || undefined}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="started" className="mb-2 block text-sm font-medium">
              Hora de início
            </Label>
            <Input
              id="started"
              type="time"
              value={startedAtLocal}
              onChange={(e) => setStartedAtLocal(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium">Localização (opcional)</Label>
          {location ? (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="size-4 shrink-0 text-primary" />
                  <span className="truncate font-mono">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </span>
                  <span>±{Math.round(location.accuracy)}m</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLocation(null);
                    setLocationName("");
                    setLocationAddress(null);
                    setLocationSource(null);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <Input
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value);
                  if (locationSource === "nominatim") setLocationSource("mixed");
                  else if (!locationSource) setLocationSource("manual");
                }}
                placeholder={resolvingPlace ? "Buscando lugar..." : "Ex: Smart Fit Paulista"}
                disabled={resolvingPlace}
                maxLength={200}
              />
              {locationAddress && (
                <p className="truncate text-[11px] text-muted-foreground" title={locationAddress}>
                  {locationAddress}
                </p>
              )}
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={requestLocation} disabled={locating}>
              {locating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MapPin className="mr-2 size-4" />}
              Usar minha localização
            </Button>
          )}
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium">Foto do dia</Label>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null, "camera")}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null, "gallery")}
          />
          <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card">
            {preview ? (
              <img src={preview} alt="Prévia" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center">
                <div>
                  <Camera className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Adicione a foto do treino</p>
                  <p className="text-xs text-muted-foreground">Prefira a câmera para não ser marcado.</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
            <Button type="button" variant="default" onClick={() => cameraRef.current?.click()}>
              <Camera className="mr-2 size-4" /> Câmera
            </Button>
            <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()}>
              <ImageIcon className="mr-2 size-4" /> Galeria
            </Button>
          </div>
          {file && (
            <div className="mt-2 max-w-sm space-y-1 text-xs text-muted-foreground">
              <p>
                Origem: <strong>{photoSource === "camera" ? "câmera" : photoSource === "gallery" ? "galeria" : "desconhecida"}</strong>
                {photoTakenAt && ` · tirada em ${new Date(photoTakenAt).toLocaleString("pt-BR")}`}
              </p>
              {photoHardBlock && (
                <p className="flex items-start gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 p-2 font-medium text-destructive">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>{photoHardBlock}</span>
                </p>
              )}
              {!photoHardBlock && photoWarning && (
                <p className="flex items-start gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 p-2 text-amber-900">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>{photoWarning}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="caption" className="mb-2 block text-sm font-medium">
            Legenda (opcional)
          </Label>
          <Textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Como foi o treino?"
            maxLength={500}
            rows={3}
          />
        </div>

        {checkedIds.length > 1 && (
          <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              Este check-in será registrado em <strong>{checkedIds.length} desafios</strong> com a mesma foto, duração e legenda.
              A pontuação é calculada em cada desafio conforme suas regras.
            </div>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={
            mutation.isPending ||
            !checkedIds.length ||
            (source === "manual" && !!photoHardBlock)
          }
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" /> Enviando…
            </>
          ) : checkedIds.length > 1 ? (
            `Fazer check-in em ${checkedIds.length} desafios`
          ) : (
            "Fazer check-in"
          )}
        </Button>
      </form>
    </>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Trash2, Coins, LogOut, Crown, Shield, ShieldPlus, ShieldMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchChallengeById, type ActiveChallenge } from "@/lib/checkins.queries";
import {
  updateChallenge,
  updateChallengeRules,
  upsertExerciseType,
  deleteExerciseType,
} from "@/lib/admin.functions";
import { listChallengeMembers, removeMember, leaveChallenge, setMemberRole } from "@/lib/challenges.functions";
import { ExercisePresetPicker } from "@/components/challenge/exercise-preset-picker";
import { FieldHint } from "@/components/challenge/field-hint";



const TIEBREAK_LABEL: Record<string, string> = {
  days: "Mais dias treinados",
  duration: "Mais minutos totais",
  first_to_reach: "Chegou primeiro à pontuação",
  weight_evolution: "Maior evolução %",
  daily_pose: "Maior número de Poses do Dia",
};

const ALL_TIEBREAKS: (keyof typeof TIEBREAK_LABEL)[] = [
  "days",
  "duration",
  "first_to_reach",
  "weight_evolution",
  "daily_pose",
];


export function ChallengeSettingsPanel({ challengeId }: { challengeId: string }) {
  const qc = useQueryClient();
  const { data: challenge, isLoading } = useQuery({
    queryKey: ["challenge-settings", challengeId],
    queryFn: () => fetchChallengeById(challengeId),
  });

  const updateFn = useServerFn(updateChallenge);
  const updateRulesFn = useServerFn(updateChallengeRules);
  const upsertFn = useServerFn(upsertExerciseType);
  const deleteFn = useServerFn(deleteExerciseType);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["challenge-settings", challengeId] });
    qc.invalidateQueries({ queryKey: ["challenge-hub", challengeId] });
    qc.invalidateQueries({ queryKey: ["active-challenge"] });
    qc.invalidateQueries({ queryKey: ["challenge-by-id", challengeId] });
    qc.invalidateQueries({ queryKey: ["my-challenges"] });
    qc.invalidateQueries({ queryKey: ["explore-public"] });
  };

  if (isLoading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
  if (!challenge) return <p className="text-sm text-muted-foreground">Desafio não encontrado.</p>;

  return (
    <div className="space-y-8">
      <ChallengeBasicsForm challenge={challenge} updateFn={updateFn} onDone={invalidate} />
      <ChallengeRulesBlock challenge={challenge} updateRulesFn={updateRulesFn} onDone={invalidate} />
      <ExercisesBlock
        challenge={challenge}
        upsertFn={upsertFn}
        deleteFn={deleteFn}
        onDone={invalidate}
      />
      <MembersBlock challengeId={challengeId} ownerId={challenge.owner_id ?? null} canManage />
    </div>
  );
}

export function MembersBlock({
  challengeId,
  ownerId,
  canManage = false,
}: {
  challengeId: string;
  ownerId: string | null;
  canManage?: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listChallengeMembers);
  const removeFn = useServerFn(removeMember);
  const leaveFn = useServerFn(leaveChallenge);
  const setRoleFn = useServerFn(setMemberRole);
  const [meId, setMeId] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["challenge-members", challengeId],
    queryFn: () => listFn({ data: { challengeId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["challenge-members", challengeId] });
    qc.invalidateQueries({ queryKey: ["challenge-hub", challengeId] });
    qc.invalidateQueries({ queryKey: ["my-challenges"] });
    qc.invalidateQueries({ queryKey: ["active-challenge"] });
  };

  const confirmRemove = async () => {
    if (!pendingRemove) return;
    setBusy(true);
    try {
      await removeFn({ data: { challengeId, userId: pendingRemove.id } });
      toast.success("Participante removido.");
      invalidate();
      setPendingRemove(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = async () => {
    setBusy(true);
    try {
      await leaveFn({ data: { challengeId } });
      toast.success("Você saiu do desafio.");
      invalidate();
      setLeaveOpen(false);
      navigate({ to: "/challenges" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleCoAdmin = async (memberId: string, currentRole: string) => {
    setRoleBusyId(memberId);
    const nextRole = currentRole === "co_admin" ? "member" : "co_admin";
    try {
      await setRoleFn({ data: { challengeId, userId: memberId, role: nextRole } });
      toast.success(nextRole === "co_admin" ? "Membro promovido a Co-ADM." : "Co-ADM removido.");
      invalidate();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRoleBusyId(null);
    }
  };

  const isOwnerViewer = !!meId && !!ownerId && meId === ownerId;


  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Participantes</h2>
      </div>
      {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      <ul className="space-y-2">
        {(data ?? []).map((m: any) => {
          const name = m.profile?.display_name ?? m.profile?.username ?? m.user_id.slice(0, 8);
          const isOwner = m.role === "owner";
          const showTrash = canManage && !isOwner && meId !== m.user_id;
          return (
            <li
              key={m.user_id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-9">
                  {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                  <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  {m.profile?.username && (
                    <p className="truncate text-xs text-muted-foreground">@{m.profile.username}</p>
                  )}
                </div>
                {isOwner && (
                  <Badge className="rounded-full bg-primary text-primary-foreground">
                    <Crown className="mr-1 size-3" /> Dono
                  </Badge>
                )}
                {m.role === "co_admin" && (
                  <Badge variant="secondary" className="rounded-full">
                    <Shield className="mr-1 size-3" /> Co-ADM
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isOwnerViewer && !isOwner && meId !== m.user_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-primary"
                    onClick={() => toggleCoAdmin(m.user_id, m.role)}
                    disabled={roleBusyId === m.user_id}
                    title={m.role === "co_admin" ? "Remover Co-ADM" : "Promover a Co-ADM"}
                  >
                    {roleBusyId === m.user_id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : m.role === "co_admin" ? (
                      <ShieldMinus className="size-4" />
                    ) : (
                      <ShieldPlus className="size-4" />
                    )}
                  </Button>
                )}
                {showTrash && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-destructive"
                    onClick={() => setPendingRemove({ id: m.user_id, name })}
                    title="Remover participante"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>

            </li>
          );
        })}
      </ul>

      <AlertDialog open={leaveOpen} onOpenChange={(v) => !busy && setLeaveOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair deste desafio?</AlertDialogTitle>
            <AlertDialogDescription>
              Você perderá o acesso ao ranking, feed e histórico deste desafio. Para voltar,
              precisará de um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                confirmLeave();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Sim, sair do desafio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingRemove}
        onOpenChange={(v) => !busy && !v && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover participante?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove ? `${pendingRemove.name} não terá mais acesso ao desafio.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                confirmRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}



function ChallengeBasicsForm({
  challenge,
  updateFn,
  onDone,
}: {
  challenge: ActiveChallenge;
  updateFn: any;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: challenge.name,
    description: challenge.description ?? "",
    maxDaysPerWeek: challenge.max_days_per_week,
    streakBonusPoints: challenge.streak_bonus_points,
    startsAt: challenge.starts_at,
    endsAt: challenge.ends_at,
    isActive: true,
  });

  useEffect(() => {
    setForm({
      name: challenge.name,
      description: challenge.description ?? "",
      maxDaysPerWeek: challenge.max_days_per_week,
      streakBonusPoints: challenge.streak_bonus_points,
      startsAt: challenge.starts_at,
      endsAt: challenge.ends_at,
      isActive: true,
    });
  }, [challenge.id]);

  return (
    <form
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await updateFn({
            data: {
              challengeId: challenge.id,
              name: form.name,
              description: form.description || null,
              maxDaysPerWeek: Number(form.maxDaysPerWeek),
              streakBonusPoints: Number(form.streakBonusPoints),
              startsAt: form.startsAt,
              endsAt: form.endsAt,
              isActive: form.isActive,
            },
          });
          toast.success("Regras atualizadas!");
          onDone();
        } catch (err: any) {
          toast.error("Falha ao salvar", { description: err.message });
        }
      }}
    >
      <h2 className="font-display text-xl font-bold">Regras da temporada</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Nome</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <Label>Máx. dias por semana</Label>
          <Input
            type="number"
            min={1}
            max={7}
            value={form.maxDaysPerWeek}
            onChange={(e) => setForm({ ...form, maxDaysPerWeek: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Bônus de streak (pts)</Label>
          <Input
            type="number"
            min={0}
            max={50}
            value={form.streakBonusPoints}
            onChange={(e) => setForm({ ...form, streakBonusPoints: Number(e.target.value) })}
          />
        </div>
        <div className="flex items-end gap-3">
          <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          <Label className="mb-0">Ativa</Label>
        </div>
        <div>
          <Label>Início</Label>
          <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        </div>
        <div>
          <Label>Fim</Label>
          <Input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <Button type="submit" className="rounded-full shadow-flame">Salvar regras</Button>
    </form>
  );
}

function ChallengeRulesBlock({
  challenge,
  updateRulesFn,
  onDone,
}: {
  challenge: ActiveChallenge;
  updateRulesFn: any;
  onDone: () => void;
}) {
  const [entryFee, setEntryFee] = useState<number>(challenge.entry_fee);
  const [currency, setCurrency] = useState<string>(challenge.currency ?? "BRL");
  const [prizes, setPrizes] = useState(
    challenge.prize_split.length
      ? challenge.prize_split.slice().sort((a, b) => a.position - b.position)
      : [
          { position: 1, percent: 70 },
          { position: 2, percent: 20 },
          { position: 3, percent: 10 },
        ],
  );
  const mergeTiebreaks = (stored: string[] | undefined) => {
    const base = stored?.length ? stored.slice() : ALL_TIEBREAKS.slice();
    ALL_TIEBREAKS.forEach((t) => {
      if (!base.includes(t)) base.push(t);
    });
    return base;
  };
  const [tiebreakers, setTiebreakers] = useState<string[]>(mergeTiebreaks(challenge.tiebreakers));
  const [cooldownMin, setCooldownMin] = useState<number>(challenge.checkin_cooldown_min);
  const [bonusStep, setBonusStep] = useState<number>(challenge.duration_bonus_step_min);
  const [bonusCapPct, setBonusCapPct] = useState<number>(challenge.duration_bonus_cap_pct);
  const [tiebreakCap, setTiebreakCap] = useState<number>(challenge.tiebreak_duration_cap_min);
  const [absencePenalty, setAbsencePenalty] = useState<number>(challenge.absence_penalty_pts ?? 0);
  const [saving, setSaving] = useState(false);

  const totalPct = prizes.reduce((a, p) => a + Number(p.percent || 0), 0);

  useEffect(() => {
    setEntryFee(challenge.entry_fee);
    setCurrency(challenge.currency ?? "BRL");
    setPrizes(
      challenge.prize_split.length
        ? challenge.prize_split.slice().sort((a, b) => a.position - b.position)
        : [
            { position: 1, percent: 70 },
            { position: 2, percent: 20 },
            { position: 3, percent: 10 },
          ],
    );
    setTiebreakers(mergeTiebreaks(challenge.tiebreakers));
    setCooldownMin(challenge.checkin_cooldown_min);
    setBonusStep(challenge.duration_bonus_step_min);
    setBonusCapPct(challenge.duration_bonus_cap_pct);
    setTiebreakCap(challenge.tiebreak_duration_cap_min);
    setAbsencePenalty(challenge.absence_penalty_pts ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id]);

  const moveTiebreak = (idx: number, dir: -1 | 1) => {
    setTiebreakers((prev) => {
      const next = prev.slice();
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <form
      className="space-y-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card p-6 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        if (Math.round(totalPct) !== 100) {
          toast.error("A soma dos percentuais precisa ser 100.");
          return;
        }
        setSaving(true);
        try {
          await updateRulesFn({
            data: {
              challengeId: challenge.id,
              entryFee: Number(entryFee),
              currency,
              prizeSplit: prizes.map((p) => ({ position: Number(p.position), percent: Number(p.percent) })),
              tiebreakers: tiebreakers as any,
              checkinCooldownMin: Number(cooldownMin),
              durationBonusStepMin: Number(bonusStep),
              durationBonusCapPct: Number(bonusCapPct),
              tiebreakDurationCapMin: Number(tiebreakCap),
              absencePenaltyPts: Number(absencePenalty),
            },
          });
          toast.success("Regras do desafio atualizadas!");
          onDone();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Coins className="size-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Regras do desafio</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div>
          <Label>Valor de entrada</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={entryFee}
            onChange={(e) => setEntryFee(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Cada participante paga esse valor pra entrar no pote.
          </p>
        </div>
        <div>
          <Label>Moeda</Label>
          <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm">Premiação</Label>
          <Badge
            variant="outline"
            className={`rounded-full ${Math.round(totalPct) === 100 ? "border-primary/40 text-primary" : "border-destructive/40 text-destructive"}`}
          >
            soma: {totalPct}%
          </Badge>
        </div>
        <ul className="space-y-2">
          {prizes.map((p, i) => (
            <li key={i} className="grid grid-cols-[64px_1fr_auto] items-center gap-2 rounded-xl border border-border bg-background p-2">
              <Input
                type="number"
                min={1}
                value={p.position}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPrizes((prev) => prev.map((x, idx) => (idx === i ? { ...x, position: v } : x)));
                }}
                title="Posição"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={p.percent}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPrizes((prev) => prev.map((x, idx) => (idx === i ? { ...x, percent: v } : x)));
                  }}
                />
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full text-destructive"
                onClick={() => setPrizes((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 rounded-full"
          onClick={() =>
            setPrizes((prev) => [...prev, { position: (prev[prev.length - 1]?.position ?? 0) + 1, percent: 0 }])
          }
        >
          <Plus className="size-4" /> Adicionar posição
        </Button>
      </div>

      <div>
        <Label className="text-sm">Ordem dos critérios de desempate</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Aplicados em cascata quando dois usuários fecham com a mesma pontuação.
        </p>
        <ol className="space-y-1.5">
          {tiebreakers.map((t, i) => (
            <li key={t} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                {i + 1}
              </span>
              <span className="flex-1 text-sm">{TIEBREAK_LABEL[t] ?? t}</span>
              <button
                type="button"
                onClick={() => moveTiebreak(i, -1)}
                disabled={i === 0}
                className="rounded-md px-2 text-xs text-muted-foreground disabled:opacity-30 hover:bg-secondary"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveTiebreak(i, 1)}
                disabled={i === tiebreakers.length - 1}
                className="rounded-md px-2 text-xs text-muted-foreground disabled:opacity-30 hover:bg-secondary"
              >
                ▼
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-border bg-background/60 p-4">
        <Label className="text-sm">Travas anti-abuso e pontuação</Label>
        <p className="mb-3 text-xs text-muted-foreground">
          Balanceamento dos pontos e proteções contra flood/inflação de duração.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-1.5">
              <Label className="text-xs">Cooldown entre check-ins (min)</Label>
              <FieldHint>
                Exemplo: Se preencher 30, o aplicativo bloqueará envios seguidos. O usuário terá que esperar 30 minutos após o primeiro treino para poder registrar o segundo.
              </FieldHint>
            </div>
            <Input
              type="number"
              min={0}
              max={240}
              value={cooldownMin}
              onChange={(e) => setCooldownMin(Number(e.target.value))}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tempo mínimo entre check-ins manuais. 0 = desativado.
            </p>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5">
              <Label className="text-xs">Bônus a cada N min extras</Label>
              <FieldHint>
                Exemplo: Se o treino mínimo for 30min e você colocar '20' aqui, o usuário que treinar 50min ganhará +1 ponto de bônus.
              </FieldHint>
            </div>
            <Input
              type="number"
              min={5}
              max={120}
              value={bonusStep}
              onChange={(e) => setBonusStep(Number(e.target.value))}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              +1 ponto a cada N min acima do mínimo do exercício.
            </p>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5">
              <Label className="text-xs">Teto do bônus de duração (%)</Label>
              <FieldHint>
                Exemplo: Se o exercício base vale 10 pts e você colocar '10%', o bônus máximo diário será de apenas 1 ponto. Mesmo se a pessoa treinar por 5 horas seguidas, o sistema trava o bônus em 1 ponto para evitar trapaças.
              </FieldHint>
            </div>
            <Input
              type="number"
              min={0}
              max={200}
              value={bonusCapPct}
              onChange={(e) => setBonusCapPct(Number(e.target.value))}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Bônus máximo em % dos pontos base. Ex: 50 → nunca ultrapassa +50%.
            </p>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5">
              <Label className="text-xs">Cap de minutos no desempate</Label>
              <FieldHint>
                Exemplo: Se dois usuários empatarem no fim do mês, o app olha quem treinou mais tempo. Se você colocar '120' aqui, o app só vai contar no máximo 2 horas por dia para cada um, evitando que alguém minta o tempo só para ganhar o desempate.
              </FieldHint>
            </div>
            <Input
              type="number"
              min={15}
              max={600}
              value={tiebreakCap}
              onChange={(e) => setTiebreakCap(Number(e.target.value))}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cada check-in contribui até esse limite no critério "minutos totais".
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
        <Label className="text-sm font-semibold text-destructive">Punição por ausência (Aversão à Perda)</Label>
        <p className="mb-3 text-xs text-muted-foreground">
          Quando o usuário não bate check-in em um dia válido, o Coach faz uma piada no feed cobrando. Se o valor
          abaixo for &gt; 0, os pontos são deduzidos automaticamente do total dele.
        </p>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr] items-center">
          <div>
            <div className="inline-flex items-center gap-1.5">
              <Label className="text-xs">Penalidade por falta (pts)</Label>
              <FieldHint>
                Exemplo: Se preencher '0.5', o usuário que esquecer de treinar na terça-feira perderá meio ponto do seu saldo total na quarta-feira.
              </FieldHint>
            </div>
            <Input
              type="number"
              min={0}
              max={1000}
              step="0.5"
              value={absencePenalty}
              onChange={(e) => setAbsencePenalty(Number(e.target.value))}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ex.: <b>0.5</b> deduz meio ponto por falta · <b>0</b> = só zoação pública, sem perda de pontos.
          </p>
        </div>
      </div>


      <Button type="submit" disabled={saving || Math.round(totalPct) !== 100} className="rounded-full shadow-flame">
        {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Salvar regras do desafio
      </Button>
    </form>
  );
}

function ExercisesBlock({
  challenge,
  upsertFn,
  deleteFn,
  onDone,
}: {
  challenge: ActiveChallenge;
  upsertFn: any;
  deleteFn: any;
  onDone: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Tipos de exercício e pontuação</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ExercisePresetPicker
            challengeId={challenge.id}
            existingNames={challenge.exercise_types.map((t) => t.name)}
            onAdded={onDone}
          />
          <NewExerciseButton challengeId={challenge.id} upsertFn={upsertFn} onDone={onDone} />
        </div>
      </div>
      <ul className="space-y-2">
        {challenge.exercise_types.map((t) => (
          <ExerciseRow
            key={t.id}
            type={t}
            challengeId={challenge.id}
            upsertFn={upsertFn}
            deleteFn={deleteFn}
            onDone={onDone}
          />
        ))}
      </ul>
    </section>
  );
}

function ExerciseRow({
  type,
  challengeId,
  upsertFn,
  deleteFn,
  onDone,
}: {
  type: { id: string; name: string; icon: string | null; points: number; min_minutes: number; sort_order: number };
  challengeId: string;
  upsertFn: any;
  deleteFn: any;
  onDone: () => void;
}) {
  const [state, setState] = useState({
    name: type.name,
    icon: type.icon ?? "",
    points: type.points,
    minMinutes: type.min_minutes,
    sortOrder: type.sort_order,
  });
  const [saving, setSaving] = useState(false);

  return (
    <li className="rounded-2xl border border-border bg-card p-3 shadow-soft">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_80px_100px_80px_auto]">
        <Input
          className="w-16"
          maxLength={4}
          value={state.icon}
          onChange={(e) => setState({ ...state, icon: e.target.value })}
          placeholder="🏋️"
        />
        <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
        <Input
          type="number"
          value={state.points}
          onChange={(e) => setState({ ...state, points: Number(e.target.value) })}
          title="Pontos"
        />
        <Input
          type="number"
          value={state.minMinutes}
          onChange={(e) => setState({ ...state, minMinutes: Number(e.target.value) })}
          title="Min. minutos"
        />
        <Input
          type="number"
          value={state.sortOrder}
          onChange={(e) => setState({ ...state, sortOrder: Number(e.target.value) })}
          title="Ordem"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="rounded-full"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await upsertFn({
                  data: {
                    id: type.id,
                    challengeId,
                    name: state.name,
                    icon: state.icon || null,
                    points: state.points,
                    minMinutes: state.minMinutes,
                    sortOrder: state.sortOrder,
                  },
                });
                toast.success("Salvo");
                onDone();
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-destructive"
            onClick={async () => {
              if (!confirm("Remover este exercício?")) return;
              try {
                await deleteFn({ data: { id: type.id } });
                toast.success("Removido");
                onDone();
              } catch (err: any) {
                toast.error(err.message);
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Ícone · Nome · Pontos · Min. minutos · Ordem
      </p>
    </li>
  );
}

function NewExerciseButton({
  challengeId,
  upsertFn,
  onDone,
}: {
  challengeId: string;
  upsertFn: any;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-full"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await upsertFn({
            data: {
              id: null,
              challengeId,
              name: "Novo exercício",
              icon: "🏃",
              points: 10,
              minMinutes: 30,
              sortOrder: 99,
            },
          });
          onDone();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Plus className="size-4" /> Novo
    </Button>
  );
}


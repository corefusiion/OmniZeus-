import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Users, Crown, Shield, LogIn, Copy, Trophy, Flag, Sparkles, Star, Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingCards } from "@/components/ui/loading-list";
import { QueryError } from "@/components/ui/query-error";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMyChallenges,
  joinChallenge,
} from "@/lib/challenges.functions";
import { getReactivationInfo } from "@/lib/reactivation.functions";
import { supabase } from "@/integrations/supabase/client";
import { RulesDialog } from "@/components/challenge/rules-dialog";
import { getChallengeStatus } from "@/lib/challenge-status";

export const Route = createFileRoute("/_authenticated/challenges/")({
  component: ChallengesPage,
});

type ChallengeRow = {
  role: "owner" | "co_admin" | "member";
  joined_at: string;
  challenge: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    starts_at: string;
    ends_at: string;
    closed_at: string | null;
    status: string | null;
    reactivation_requested: boolean | null;
    invite_code: string | null;
    invite_enabled: boolean;
    max_days_per_week: number;
    streak_bonus_points: number;
    checkin_cooldown_min: number;
    duration_bonus_step_min: number;
    duration_bonus_cap_pct: number;
    tiebreak_duration_cap_min: number;
  };
};

function isFinished(c: ChallengeRow["challenge"]) {
  const today = new Date().toISOString().slice(0, 10);
  return !!c.closed_at || c.status === "closed" || c.is_active === false || c.ends_at < today;
}

function ChallengesPage() {
  const listFn = useServerFn(getMyChallenges);
  const joinFn = useServerFn(joinChallenge);
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reactivated") === "1") {
      toast.success("🎉 Pagamento confirmado! Sua nova temporada está sendo criada. Recarregando em instantes...");
      const t = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["my-challenges"] });
        router.navigate({ to: "/challenges", replace: true });
      }, 2500);
      return () => clearTimeout(t);
    }
    if (params.get("reactivate_canceled") === "1") {
      toast.info("Reativação cancelada. Você pode tentar novamente quando quiser.");
      router.navigate({ to: "/challenges", replace: true });
    }
  }, [qc, router]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["my-challenges"],
    queryFn: () => listFn(),
  });

  const joinMut = useMutation({
    mutationFn: (c: string) => joinFn({ data: { code: c.trim().toUpperCase() } }),
    onSuccess: () => {
      toast.success("Entrou no desafio!");
      setCode("");
      qc.invalidateQueries({ queryKey: ["my-challenges"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { active, finished } = useMemo(() => {
    const rows = (data ?? []) as ChallengeRow[];
    const active: ChallengeRow[] = [];
    const finished: ChallengeRow[] = [];
    for (const r of rows) {
      if (isFinished(r.challenge)) finished.push(r);
      else active.push(r);
    }
    return { active, finished };
  }, [data]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Meus desafios"
        subtitle="Crie um novo desafio ou entre com um código de convite."
      />

      <Link
        to="/store"
        className="group flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 px-4 py-3 transition hover:border-amber-500/60 hover:from-amber-500/20"
      >
        <Crown className="size-5 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Vire <span className="text-amber-600 dark:text-amber-400">FitCrew PRO</span> — até 300 membros por desafio
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Selo Oficial, ChatFit ilimitado, IA Anti-Trapaça grátis. A partir de R$ 16,58/mês.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm sm:inline-flex">
          Ver planos
        </span>
      </Link>


      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/challenges/new"
          className="group flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 transition hover:border-primary hover:bg-primary/10"
        >
          <div className="rounded-full bg-primary p-3 text-primary-foreground">
            <Plus className="size-5" />
          </div>
          <div>
            <p className="font-display text-lg font-bold">Criar desafio</p>
            <p className="text-sm text-muted-foreground">Vira ADM da sua própria temporada.</p>
          </div>
        </Link>

        <form
          className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) joinMut.mutate(code);
          }}
        >
          <div className="flex items-center gap-2">
            <LogIn className="size-5 text-primary" />
            <p className="font-display font-bold">Entrar por código</p>
          </div>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={16}
              className="font-mono uppercase"
            />
            <Button type="submit" disabled={joinMut.isPending} className="rounded-full">
              Entrar
            </Button>
          </div>
        </form>
      </div>

      <section className="space-y-3">
        {isLoading ? (
          <LoadingCards count={2} />
        ) : isError ? (
          <QueryError
            label="seus desafios"
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => refetch()}
          />
        ) : !data?.length ? (
          <EmptyState
            icon={Trophy}
            title="Nenhum desafio ainda"
            description="Crie o seu ou entre por código de convite para começar a batalhar com a crew."
          />
        ) : (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="active">
                Ativos {active.length > 0 && <span className="ml-1 text-xs opacity-70">({active.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="finished">
                Finalizados {finished.length > 0 && <span className="ml-1 text-xs opacity-70">({finished.length})</span>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-4">
              {active.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="Nenhum desafio ativo"
                  description="Todos os seus desafios já foram encerrados. Crie um novo ou veja os finalizados."
                />
              ) : (
                <ul className="space-y-2">
                  {active.map((m) => (
                    <ChallengeRowItem key={m.challenge.id} row={m} finished={false} />
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="finished" className="mt-4">
              {finished.length === 0 ? (
                <EmptyState
                  icon={Flag}
                  title="Nenhum desafio finalizado"
                  description="Quando um desafio expirar, ele aparecerá aqui com o histórico preservado."
                />
              ) : (
                <ul className="space-y-2">
                  {finished.map((m) => (
                    <ChallengeRowItem key={m.challenge.id} row={m} finished />
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}
      </section>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function ChallengeRowItem({ row, finished }: { row: ChallengeRow; finished: boolean }) {
  const isAdmin = row.role === "owner" || row.role === "co_admin";
  const inviteUrl =
    typeof window !== "undefined" && row.challenge.invite_code
      ? `${window.location.origin}/join/${row.challenge.invite_code}`
      : "";
  const [reactivateOpen, setReactivateOpen] = useState(false);

  return (
    <li
      className={
        "rounded-2xl border border-border bg-card shadow-soft transition hover:border-primary/40 " +
        (finished ? "opacity-70 grayscale-[0.4]" : "")
      }
    >
      {finished && (
        <div className="flex items-start gap-2 rounded-t-2xl border-b border-border bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
          <Flag className="mt-0.5 size-3.5 shrink-0" />
          <p>
            🏁 Este desafio foi encerrado em{" "}
            <span className="font-semibold text-foreground">
              {formatDate(row.challenge.closed_at ?? row.challenge.ends_at)}
            </span>
            . O histórico está preservado.
          </p>
        </div>
      )}

      <Link
        to="/c/$id"
        params={{ id: row.challenge.id }}
        className="flex flex-wrap items-center justify-between gap-3 p-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-lg font-bold">{row.challenge.name}</p>
            {row.role === "owner" && (
              <Badge className="rounded-full bg-primary text-primary-foreground">
                <Crown className="mr-1 size-3" /> Dono
              </Badge>
            )}
            {row.role === "co_admin" && (
              <Badge variant="secondary" className="rounded-full">
                <Shield className="mr-1 size-3" /> Co-ADM
              </Badge>
            )}
            {finished && (
              <Badge variant="outline" className="rounded-full text-muted-foreground">
                encerrado
              </Badge>
            )}
          </div>
          {row.challenge.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {row.challenge.description}
            </p>
          )}
          {!finished && (
            <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
              {getChallengeStatus(row.challenge.starts_at, row.challenge.ends_at).label}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Users className="size-3.5" /> Abrir
        </span>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {!finished && isAdmin && row.challenge.invite_code && row.challenge.invite_enabled && (
            <button
              type="button"
              title="Copiar código do desafio"
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground hover:bg-muted/70"
              onClick={(e) => {
                e.preventDefault();
                navigator.clipboard.writeText(row.challenge.invite_code!);
                toast.success(`Código ${row.challenge.invite_code} copiado!`);
              }}
            >
              <Copy className="size-3" /> {row.challenge.invite_code}
            </button>
          )}
          {!finished && inviteUrl && row.challenge.invite_enabled && isAdmin && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/50"
              onClick={(e) => {
                e.preventDefault();
                navigator.clipboard.writeText(inviteUrl);
                toast.success("Link de convite copiado!");
              }}
            >
              Link
            </button>
          )}
          {!finished && <RulesDialog challenge={row.challenge} />}
        </div>

        {finished && isAdmin && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setReactivateOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            <Star className="size-3.5 fill-current" /> Reativar Desafio
            <Sparkles className="size-3" />
          </button>
        )}
      </div>

      {finished && isAdmin && (
        <ReactivateModal
          open={reactivateOpen}
          onOpenChange={setReactivateOpen}
          challengeId={row.challenge.id}
          challengeName={row.challenge.name}
        />
      )}
    </li>
  );
}

function reactivateApiUrl() {
  if (typeof window === "undefined") return "/api/public/reactivate-checkout";
  const hostname = window.location.hostname;
  const isLovableRuntime =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com");
  return isLovableRuntime
    ? "/api/public/reactivate-checkout"
    : "https://fitcrew.lovable.app/api/public/reactivate-checkout";
}

function ReactivateModal({
  open,
  onOpenChange,
  challengeId,
  challengeName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  challengeId: string;
  challengeName: string;
}) {
  const infoFn = useServerFn(getReactivationInfo);
  const { data: info, isLoading, isError, error } = useQuery({
    queryKey: ["reactivation-info", challengeId],
    queryFn: () => infoFn({ data: { challengeId } }),
    enabled: open,
  });

  const [paying, setPaying] = useState(false);

  const startCheckout = async () => {
    setPaying(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const res = await fetch(reactivateApiUrl(), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ challengeId }),
      });
      const payload = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !payload?.url) throw new Error(payload?.error ?? "Falha ao abrir checkout.");
      window.location.href = payload.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar checkout.");
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="size-5 fill-amber-500 text-amber-500" />
            Iniciar Nova Temporada
          </DialogTitle>
          <DialogDescription>
            Vamos criar uma nova temporada de <strong>"{challengeName}"</strong>, migrando todos os
            participantes atuais com a pontuação zerada. O histórico antigo continuará salvo. 🚀
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="grid place-items-center py-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {isError && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar informações."}
          </p>
        )}

        {info?.alreadyReactivated && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            ✅ Este desafio já foi reativado em uma nova temporada.
          </div>
        )}

        {info && !info.alreadyReactivated && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Membros atuais</span>
              <span className="font-semibold">{info.memberCount}</span>
            </div>
            <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-400">
                {info.tier === "pro" ? "Taxa de Reativação PRO" : "Taxa de Reativação"}
              </p>
              <p className="mt-1 font-display text-3xl font-bold">{info.priceLabel}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {info.tier === "pro"
                  ? "Desafio com 21 a 300 membros (PRO)."
                  : "Desafio com até 20 membros."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={paying}>
            Cancelar
          </Button>
          {info && !info.alreadyReactivated && (
            <Button
              onClick={startCheckout}
              disabled={paying}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:brightness-110"
            >
              {paying ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Abrindo checkout...
                </>
              ) : (
                <>Pagar {info.priceLabel} e criar temporada</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


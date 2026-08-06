import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { getMyChallenges } from "@/lib/challenges.functions";
import { getFollowStats } from "@/lib/follows.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Me = {
  userId: string;
  email: string | null | undefined;
  profile: {
    id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
    weight_kg: number | null;
    height_cm: number | null;
    location: string | null;
    favorite_sport: string | null;
    weekly_goal: number;
  } | null;
  isAdmin: boolean;
} | null | undefined;

type MyChallenge = {
  id: string;
  name: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  max_days_per_week: number;
  streak_bonus_points: number;
};

type TopRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
};

const LS_KEY = "rr:selectedChallengeId";

export function RightRail({ me }: { me: Me }) {
  const myChallengesFn = useServerFn(getMyChallenges);
  const followStatsFn = useServerFn(getFollowStats);

  // Only challenges the user is a member of, currently active by date + flag.
  const { data: myChallenges } = useQuery({
    queryKey: ["my-challenges", me?.userId],
    enabled: !!me?.userId,
    queryFn: () => myChallengesFn(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const activeChallenges = useMemo<MyChallenge[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return ((myChallenges ?? []) as any[])
      .map((r) => r.challenge)
      .filter((c) => c && c.is_active && c.ends_at >= today)
      .map((c) => ({
        id: c.id,
        name: c.name,
        is_active: c.is_active,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        max_days_per_week: c.max_days_per_week ?? 6,
        streak_bonus_points: c.streak_bonus_points ?? 0,
      }));
  }, [myChallenges]);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LS_KEY);
  });

  useEffect(() => {
    if (!activeChallenges.length) return;
    if (!selectedId || !activeChallenges.some((c) => c.id === selectedId)) {
      const first = activeChallenges[0].id;
      setSelectedId(first);
      try {
        window.localStorage.setItem(LS_KEY, first);
      } catch {
        /* ignore quota errors */
      }
    }
  }, [activeChallenges, selectedId]);

  const selected = activeChallenges.find((c) => c.id === selectedId) ?? null;

  // Lightweight Top-N via SQL function (no full leaderboard download).
  const { data: top3 } = useQuery({
    queryKey: ["leaderboard-top3", selected?.id],
    enabled: !!selected?.id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<TopRow[]> => {
      const { data, error } = await (supabase as any).rpc("leaderboard_top_v1", {
        _challenge_id: selected!.id,
        _limit: 3,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        display_name: r.display_name ?? "Sem nome",
        avatar_url: r.avatar_url ?? null,
        total_points: Number(r.total_points ?? 0),
      }));
    },
  });

  const { data: myStats } = useQuery({
    queryKey: ["follow-stats", me?.userId],
    enabled: !!me?.userId,
    queryFn: () => followStatsFn({ data: { userId: me!.userId } }),
    staleTime: 60_000,
  });

  const initials = (me?.profile?.display_name ?? me?.email ?? "?").slice(0, 2).toUpperCase();
  const myRank =
    me?.userId && top3
      ? top3.findIndex((r) => r.user_id === me.userId) + 1 || null
      : null;

  const showSelector = activeChallenges.length > 1;

  return (
    <div className="space-y-4 pb-6">
      {me?.profile && (
        <Link
          to="/profile/$userId"
          params={{ userId: me.userId }}
          className="block overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition hover:border-primary/40"
        >
          <div className="h-16 bg-gradient-to-br from-primary via-primary/70 to-accent" />
          <div className="-mt-8 px-5 pb-5">
            <Avatar className="size-16 border-4 border-card">
              <AvatarImage src={me.profile.avatar_url ?? undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <p className="mt-3 font-display text-lg font-bold leading-tight">
              {me.profile.display_name}
            </p>
            {me.profile.username && (
              <p className="text-xs text-muted-foreground">@{me.profile.username}</p>
            )}
            {me.profile.bio && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{me.profile.bio}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              {me.profile.location && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                  📍 {me.profile.location}
                </span>
              )}
              {me.profile.favorite_sport && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                  🏅 {me.profile.favorite_sport}
                </span>
              )}
              {me.profile.weight_kg && (
                <span className="rounded-full bg-secondary px-2 py-0.5 tabular-nums text-secondary-foreground">
                  {me.profile.weight_kg}kg
                </span>
              )}
              {me.profile.height_cm && (
                <span className="rounded-full bg-secondary px-2 py-0.5 tabular-nums text-secondary-foreground">
                  {me.profile.height_cm}cm
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-secondary/40 p-2 text-center">
              <StatMini value={myStats?.checkins} label="Check-ins" />
              <StatMini value={myStats?.followers} label="Seguidores" />
              <StatMini value={myStats?.following} label="Seguindo" />
            </div>
            {myRank && (
              <p className="mt-3 text-xs font-semibold text-primary">
                #{myRank} no ranking do desafio
              </p>
            )}
          </div>
        </Link>
      )}

      {!selected ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-5 text-center shadow-soft">
          <Trophy className="mx-auto size-5 text-primary" />
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            Entre num desafio pra ver o Top 3 e as regras aqui.
          </p>
          <Link
            to="/challenges"
            className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
          >
            Ver desafios
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h3 className="font-display text-sm font-bold uppercase tracking-widest">
                  Top 3
                </h3>
              </div>
              <Link
                to="/c/$id/ranking"
                params={{ id: selected.id }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver tudo
              </Link>
            </div>

            <ChallengeContext
              selected={selected}
              showSelector={showSelector}
              activeChallenges={activeChallenges}
              onChange={(id) => {
                setSelectedId(id);
                try {
                  window.localStorage.setItem(LS_KEY, id);
                } catch {
                  /* ignore quota errors */
                }
              }}
            />

            {!top3 || top3.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Placar vazio — bora começar!
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {top3.map((r, i) => {
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
                  return (
                    <li key={r.user_id}>
                      <Link
                        to="/profile/$userId"
                        params={{ userId: r.user_id }}
                        className="flex items-center gap-2 rounded-xl p-2 transition hover:bg-secondary/60"
                      >
                        <span className="text-lg">{medal}</span>
                        <Avatar className="size-7 border border-border">
                          <AvatarImage src={r.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {r.display_name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {r.display_name}
                        </span>
                        <span className="tabular-nums font-display text-sm font-bold">
                          {r.total_points}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-widest">
                Regras do desafio
              </h3>
            </div>
            <ChallengeChip name={selected.name} />
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>
                Máx{" "}
                <b className="text-foreground">
                  {selected.max_days_per_week} dias
                </b>{" "}
                por semana contando.
              </li>
              <li>Mínimo de duração varia por exercício (≥30min).</li>
              <li>
                Bônus de streak:{" "}
                <b className="text-foreground">
                  +{selected.streak_bonus_points} pts
                </b>
                .
              </li>
              <li>Foto do dia obrigatória em check-in manual.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function ChallengeContext({
  selected,
  showSelector,
  activeChallenges,
  onChange,
}: {
  selected: MyChallenge;
  showSelector: boolean;
  activeChallenges: MyChallenge[];
  onChange: (id: string) => void;
}) {
  if (showSelector) {
    return (
      <div className="mt-3">
        <Select value={selected.id} onValueChange={onChange}>
          <SelectTrigger className="h-8 rounded-full border-primary/30 bg-primary/5 text-xs font-semibold">
            <SelectValue placeholder="Escolha um desafio" />
          </SelectTrigger>
          <SelectContent>
            {activeChallenges.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return <ChallengeChip name={selected.name} />;
}

function ChallengeChip({ name }: { name: string }) {
  return (
    <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-semibold text-primary">
      <span aria-hidden>🏁</span>
      <span className="truncate">{name}</span>
    </div>
  );
}

function StatMini({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-base font-bold leading-none tabular-nums">
        {value ?? "—"}
      </span>
      <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

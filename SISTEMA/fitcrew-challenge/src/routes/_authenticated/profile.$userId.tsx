import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Flame, ImageOff, Instagram, MapPin, Ruler, Trophy, Twitter, Weight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchActiveChallenge, fetchProfileStats } from "@/lib/checkins.queries";
import { fetchUserTimeline } from "@/lib/timeline.queries";
import { BadgesGrid } from "@/components/profile/badges-grid";
import { TimelineList } from "@/components/feed/timeline-list";
import { BackButton } from "@/components/back-button";
import { FollowButton } from "@/components/follow-button";
import { useServerFn } from "@tanstack/react-start";
import { getFollowStats } from "@/lib/follows.functions";


export const Route = createFileRoute("/_authenticated/profile/$userId")({
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const { data: challenge } = useQuery({
    queryKey: ["active-challenge"],
    queryFn: fetchActiveChallenge,
  });
  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const { data: extra } = useQuery({
    queryKey: ["profile-extra", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("weight_kg, height_cm, location, favorite_sport, instagram_handle, tiktok_handle, twitter_handle")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: ["profile-stats", userId, challenge?.id],
    enabled: !!challenge?.id,
    queryFn: () => fetchProfileStats(userId, challenge!.id),
  });
  const { data: userTimeline } = useQuery({
    queryKey: ["user-timeline", userId],
    queryFn: () => fetchUserTimeline(userId),
  });
  const followStatsFn = useServerFn(getFollowStats);
  const { data: followStats } = useQuery({
    queryKey: ["follow-stats", userId],
    queryFn: () => followStatsFn({ data: { userId } }),
  });
  const { data: meData } = useQuery({
    queryKey: ["me-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { isAdmin: false };
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return { isAdmin: (roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin") };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 pb-24 lg:pb-8" role="status" aria-live="polite" aria-label="Carregando perfil">
        <div className="h-32 animate-pulse rounded-3xl bg-muted" />
        <div className="mx-auto -mt-10 size-24 animate-pulse rounded-full border-4 border-background bg-muted" />
        <div className="mx-auto h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mx-auto h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center shadow-soft">
        <p className="font-display text-lg font-bold">Perfil não encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Esse usuário pode ter saído do desafio ou o link está desatualizado.
        </p>
      </div>
    );
  }

  const { profile, totalPoints, countedDays, extraCheckins, totalMinutes, currentStreak, longestStreak, history } = data;
  const initials = (profile.display_name ?? "?").slice(0, 2).toUpperCase();
  const isMe = me === userId;
  const photos = history.filter((h) => h.photo_signed_url);

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      <BackButton label={challenge?.name ? `Voltar para ${challenge.name}` : "Voltar"} />
      {/* Banner + header */}


      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <div className="relative h-32 bg-gradient-to-br from-primary via-primary/70 to-accent sm:h-40">
          {(extra?.instagram_handle || extra?.tiktok_handle || extra?.twitter_handle) && (
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {extra?.instagram_handle && (
                <a
                  href={`https://instagram.com/${extra.instagram_handle}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={`Instagram @${extra.instagram_handle}`}
                  className="grid size-8 place-items-center rounded-full bg-white/95 text-foreground shadow-soft backdrop-blur transition hover:scale-110 hover:text-primary"
                >
                  <Instagram className="size-4" />
                </a>
              )}
              {extra?.tiktok_handle && (
                <a
                  href={`https://tiktok.com/@${extra.tiktok_handle}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={`TikTok @${extra.tiktok_handle}`}
                  className="grid size-8 place-items-center rounded-full bg-white/95 text-foreground shadow-soft backdrop-blur transition hover:scale-110 hover:text-primary"
                >
                  <span className="text-[11px] font-black tracking-tight">TT</span>
                </a>
              )}
              {extra?.twitter_handle && (
                <a
                  href={`https://x.com/${extra.twitter_handle}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={`X @${extra.twitter_handle}`}
                  className="grid size-8 place-items-center rounded-full bg-white/95 text-foreground shadow-soft backdrop-blur transition hover:scale-110 hover:text-primary"
                >
                  <Twitter className="size-4" />
                </a>
              )}
            </div>
          )}
        </div>
        <div className="-mt-12 px-6 pb-6 sm:-mt-14">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div className="flex min-w-0 items-end gap-4">
              <Avatar className="size-24 shrink-0 border-4 border-card shadow-soft sm:size-28">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
            </div>
            {isMe ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/settings">Editar perfil</Link>
              </Button>
            ) : (
              <FollowButton userId={userId} />
            )}
          </div>
          {/* Stats row (Instagram-like) */}
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex flex-col items-start">
              <span className="font-display text-lg font-bold leading-none tabular-nums">
                {followStats?.checkins ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">Check-ins</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-display text-lg font-bold leading-none tabular-nums">
                {followStats?.followers ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">Seguidores</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-display text-lg font-bold leading-none tabular-nums">
                {followStats?.following ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">Seguindo</span>
            </div>
          </div>
          <div className="mt-4">
            <h1 className="font-display text-3xl font-bold leading-tight">{profile.display_name}</h1>
            {profile.username && (
              <p className="mt-0.5 font-mono text-sm text-muted-foreground">@{profile.username}</p>
            )}
            {profile.bio && <p className="mt-2 text-sm leading-relaxed text-foreground">{profile.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {extra?.location && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                  <MapPin className="size-3" /> {extra.location}
                </span>
              )}
              {extra?.favorite_sport && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                  🏅 {extra.favorite_sport}
                </span>
              )}
              {extra?.weight_kg != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 tabular-nums text-secondary-foreground">
                  <Weight className="size-3" /> {extra.weight_kg}kg
                </span>
              )}
              {extra?.height_cm != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 tabular-nums text-secondary-foreground">
                  <Ruler className="size-3" /> {extra.height_cm}cm
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                🎯 Meta: {profile.weekly_goal} treinos/semana
              </span>
            </div>
            {(extra?.instagram_handle || extra?.tiktok_handle || extra?.twitter_handle) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {extra?.instagram_handle && (
                  <a
                    href={`https://instagram.com/${extra.instagram_handle}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                  >
                    <Instagram className="size-3.5" /> @{extra.instagram_handle}
                  </a>
                )}
                {extra?.tiktok_handle && (
                  <a
                    href={`https://tiktok.com/@${extra.tiktok_handle}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                  >
                    <span className="font-bold">TT</span> @{extra.tiktok_handle}
                  </a>
                )}
                {extra?.twitter_handle && (
                  <a
                    href={`https://x.com/${extra.twitter_handle}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                  >
                    <Twitter className="size-3.5" /> @{extra.twitter_handle}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              icon={<Trophy className="size-4" />}
              label="Pontos"
              value={totalPoints}
              highlight
            />
            <Stat icon={<Calendar className="size-4" />} label="Dias contados" value={countedDays} />
            <Stat icon={<Flame className="size-4" />} label="Streak" value={`${currentStreak}d`} />
            <Stat icon={<Clock className="size-4" />} label="Minutos" value={totalMinutes} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Maior sequência: <span className="font-semibold text-foreground">{longestStreak} dias</span>
            {extraCheckins > 0 && ` · ${extraCheckins} check-in(s) extra fora do limite`}
          </p>

        </div>
      </div>

      {/* Conquistas */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Conquistas</h2>
        <BadgesGrid userId={userId} />
      </section>

      {/* Feed do usuário */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Publicações</h2>
        {!userTimeline || userTimeline.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
            Sem publicações ainda.
          </div>
        ) : (
          <TimelineList
            items={userTimeline}
            currentUserId={me ?? null}
            isAdmin={meData?.isAdmin ?? false}
            queryKey={["user-timeline", userId]}
          />
        )}
      </section>

      {/* Photos grid */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Fotos</h2>
        {photos.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-3xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground shadow-soft">
            <ImageOff className="size-6" />
            <p className="text-sm">Nenhuma foto ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-2xl bg-secondary shadow-soft">
                <img src={p.photo_signed_url!} alt={p.caption ?? ""} className="size-full object-cover" loading="lazy" />
                {p.over_limit && (
                  <span className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    +0
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Histórico do desafio</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum check-in ainda.</p>
        ) : (
          <ol className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-lg">
                  {h.exercise?.icon ?? "🏋️"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold">
                    {h.exercise?.name ?? "Exercício"} · {h.duration_min}min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(h.occurred_on + "T00:00:00").toLocaleDateString("pt-BR")}
                    {h.source !== "manual" && ` · via ${h.source}`}
                  </p>
                </div>
                <Badge variant={h.over_limit ? "secondary" : "default"} className="rounded-full">
                  {h.over_limit ? "extra" : `+${h.points_awarded}`}
                </Badge>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        highlight
          ? "border-primary/30 bg-primary/10"
          : "border-border bg-secondary/40"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-xs ${
          highlight ? "font-semibold text-primary" : "text-muted-foreground"
        }`}
      >
        {icon}
        {label}
      </div>
      <p
        className={`mt-1 font-display text-2xl font-bold leading-none tabular-nums ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}


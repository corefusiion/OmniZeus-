import { supabase } from "@/integrations/supabase/client";

export type ActiveChallenge = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  starts_at: string;
  ends_at: string;
  max_days_per_week: number;
  streak_bonus_points: number;
  entry_fee: number;
  currency: string;
  prize_split: { position: number; percent: number }[];
  tiebreakers: ("days" | "duration" | "first_to_reach" | "weight_evolution" | "daily_pose")[];
  checkin_cooldown_min: number;
  duration_bonus_step_min: number;
  duration_bonus_cap_pct: number;
  tiebreak_duration_cap_min: number;
  absence_penalty_pts: number;
  exercise_types: {
    id: string;
    name: string;
    icon: string | null;
    points: number;
    min_minutes: number;
    sort_order: number;
  }[];
};

const CHALLENGE_COLS =
  "id, name, description, owner_id, starts_at, ends_at, max_days_per_week, streak_bonus_points, entry_fee, currency, prize_split, tiebreakers, checkin_cooldown_min, duration_bonus_step_min, duration_bonus_cap_pct, tiebreak_duration_cap_min, absence_penalty_pts";

async function hydrateChallenge(challenge: any): Promise<ActiveChallenge> {
  const { data: types, error: tErr } = await supabase
    .from("exercise_types")
    .select("id, name, icon, points, min_minutes, sort_order")
    .eq("challenge_id", challenge.id)
    .order("sort_order", { ascending: true });
  if (tErr) throw tErr;
  const c = challenge;
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    owner_id: c.owner_id ?? null,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    max_days_per_week: c.max_days_per_week,
    streak_bonus_points: c.streak_bonus_points,
    entry_fee: Number(c.entry_fee ?? 50),
    currency: c.currency ?? "BRL",
    prize_split: (c.prize_split ?? []) as { position: number; percent: number }[],
    tiebreakers: (c.tiebreakers ?? ["days", "duration", "first_to_reach", "weight_evolution", "daily_pose"]) as any,
    checkin_cooldown_min: Number(c.checkin_cooldown_min ?? 30),
    duration_bonus_step_min: Number(c.duration_bonus_step_min ?? 15),
    duration_bonus_cap_pct: Number(c.duration_bonus_cap_pct ?? 50),
    tiebreak_duration_cap_min: Number(c.tiebreak_duration_cap_min ?? 120),
    absence_penalty_pts: Number(c.absence_penalty_pts ?? 0),
    exercise_types: types ?? [],
  };
}

export async function fetchActiveChallenge(): Promise<ActiveChallenge | null> {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select(CHALLENGE_COLS as any)
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!challenge) return null;
  return hydrateChallenge(challenge);
}

export async function fetchChallengeById(id: string): Promise<ActiveChallenge | null> {
  const { data: challenge, error } = await supabase
    .from("challenges")
    .select(CHALLENGE_COLS as any)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!challenge) return null;
  return hydrateChallenge(challenge);
}



export type FeedCheckin = {
  id: string;
  user_id: string;
  challenge_id: string;
  batch_id: string | null;
  challenges: { id: string; name: string }[];
  occurred_on: string;
  duration_min: number;
  photo_url: string;
  photo_signed_url: string | null;
  caption: string | null;
  points_awarded: number;
  over_limit: boolean;
  used_daily_pose: boolean;
  ai_validated: string | null;
  created_at: string;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  exercise: { name: string; icon: string | null; points: number } | null;
  author: { display_name: string; username: string | null; avatar_url: string | null } | null;
  reactions: { emoji: string; user_id: string }[];
  comments: {
    id: string;
    user_id: string;
    body: string;
    created_at: string;
    is_bot?: boolean;
    flagged_terms?: string[] | null;
    author: { display_name: string; username: string | null; avatar_url: string | null } | null;
  }[];
};


export async function fetchFeed(challengeId: string): Promise<FeedCheckin[]> {
  const { data, error } = await supabase
    .from("checkins")
    .select(
      `id, user_id, challenge_id, batch_id, occurred_on, duration_min, photo_url, caption, points_awarded, over_limit, used_daily_pose, ai_validated, created_at, location_name, location_address, location_lat, location_lng,
       exercise:exercise_types(name, icon, points),
       reactions:checkin_reactions(emoji, user_id),
       comments:checkin_comments(id, user_id, body, created_at, is_bot, flagged_terms)` as any,
    )
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;


  const rows = (data ?? []) as any[];
  const userIds = Array.from(
    new Set<string>([
      ...rows.map((r) => r.user_id),
      ...rows.flatMap((r) => (r.comments ?? []).map((c: any) => c.user_id)),
    ]),
  );

  const profilesById = new Map<string, { display_name: string; username: string | null; avatar_url: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);
    (profiles ?? []).forEach((p) => profilesById.set(p.id, { display_name: p.display_name, username: p.username ?? null, avatar_url: p.avatar_url }));
  }

  const paths = Array.from(new Set(rows.map((r) => r.photo_url).filter(Boolean) as string[]));
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const results = await Promise.all(
      paths.map((p) =>
        supabase.storage
          .from("checkin-photos")
          .createSignedUrl(p, 60 * 60, { transform: { width: 800, quality: 75, resize: "contain" } })
          .then((r) => ({ path: p, url: r.data?.signedUrl ?? null })),
      ),
    );
    results.forEach((r) => {
      if (r.url) signedByPath.set(r.path, r.url);
    });
  }

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    challenge_id: r.challenge_id,
    batch_id: r.batch_id ?? null,
    challenges: [],
    occurred_on: r.occurred_on,
    duration_min: r.duration_min,
    photo_url: r.photo_url,
    photo_signed_url: signedByPath.get(r.photo_url) ?? null,
    caption: r.caption,
    points_awarded: r.points_awarded,
    over_limit: r.over_limit,
    used_daily_pose: !!r.used_daily_pose,
    ai_validated: r.ai_validated ?? null,
    created_at: r.created_at,
    location_name: r.location_name ?? null,
    location_address: r.location_address ?? null,
    location_lat: r.location_lat ?? null,
    location_lng: r.location_lng ?? null,
    exercise: r.exercise ?? null,
    author: profilesById.get(r.user_id) ?? null,
    reactions: r.reactions ?? [],
    comments: (r.comments ?? [])
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        body: c.body,
        created_at: c.created_at,
        is_bot: !!c.is_bot,
        flagged_terms: (c.flagged_terms ?? null) as string[] | null,
        author: profilesById.get(c.user_id) ?? null,
      })),

  }));
}

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  counted_days: number;
  extra_checkins: number;
  current_streak: number;
  longest_streak: number;
};

export async function fetchLeaderboard(challengeId: string): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("checkins")
    .select("user_id, occurred_on, points_awarded, over_limit")
    .eq("challenge_id", challengeId);
  if (error) throw error;

  const byUser = new Map<
    string,
    { total: number; days: Set<string>; extras: number }
  >();
  (data ?? []).forEach((c) => {
    const entry = byUser.get(c.user_id) ?? { total: 0, days: new Set<string>(), extras: 0 };
    entry.total += c.points_awarded ?? 0;
    if (c.over_limit) entry.extras += 1;
    else entry.days.add(c.occurred_on);
    byUser.set(c.user_id, entry);
  });

  const userIds = Array.from(byUser.keys());
  const profilesById = new Map<string, { display_name: string; username: string | null; avatar_url: string | null }>();
  if (userIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", userIds);
    (profiles ?? []).forEach((p) => profilesById.set(p.id, { display_name: p.display_name, username: p.username ?? null, avatar_url: p.avatar_url }));
  }

  // inclui todo mundo do grupo, mesmo sem check-in
  const { data: allProfiles } = await supabase.from("profiles").select("id, display_name, username, avatar_url");
  (allProfiles ?? []).forEach((p) => {
    if (!byUser.has(p.id)) byUser.set(p.id, { total: 0, days: new Set(), extras: 0 });
    if (!profilesById.has(p.id)) profilesById.set(p.id, { display_name: p.display_name, username: p.username ?? null, avatar_url: p.avatar_url });
  });

  return Array.from(byUser.entries())
    .map(([user_id, v]) => {
      const { current, longest } = computeStreaks(Array.from(v.days));
      return {
        user_id,
        display_name: profilesById.get(user_id)?.display_name ?? "Sem nome",
        avatar_url: profilesById.get(user_id)?.avatar_url ?? null,
        total_points: v.total,
        counted_days: v.days.size,
        extra_checkins: v.extras,
        current_streak: current,
        longest_streak: longest,
      };
    })
    .sort((a, b) => b.total_points - a.total_points || b.counted_days - a.counted_days);
}

export async function uploadCheckinPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("checkin-photos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

/** Longest and current streak of counted (over_limit=false) days in ISO YYYY-MM-DD list */
export function computeStreaks(days: string[]): { current: number; longest: number } {
  if (!days.length) return { current: 0, longest: 0 };
  const uniq = Array.from(new Set(days)).sort();
  let longest = 1;
  let run = 1;
  const parse = (s: string) => new Date(s + "T00:00:00Z").getTime();
  const DAY = 86400000;
  for (let i = 1; i < uniq.length; i++) {
    if (parse(uniq[i]) - parse(uniq[i - 1]) === DAY) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  // current streak = consecutive up to today or yesterday
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const yestISO = new Date(today.getTime() - DAY).toISOString().slice(0, 10);
  const last = uniq[uniq.length - 1];
  if (last !== todayISO && last !== yestISO) return { current: 0, longest };
  let current = 1;
  for (let i = uniq.length - 2; i >= 0; i--) {
    if (parse(uniq[i + 1]) - parse(uniq[i]) === DAY) current++;
    else break;
  }
  return { current, longest };
}

export type ProfileStats = {
  profile: { id: string; display_name: string; username: string | null; avatar_url: string | null; bio: string | null; weekly_goal: number };
  totalPoints: number;
  countedDays: number;
  extraCheckins: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  history: Array<{
    id: string;
    occurred_on: string;
    duration_min: number;
    points_awarded: number;
    over_limit: boolean;
    source: string;
    photo_url: string | null;
    photo_signed_url: string | null;
    caption: string | null;
    exercise: { name: string; icon: string | null } | null;
  }>;
};

export async function fetchProfileStats(userId: string, challengeId: string): Promise<ProfileStats | null> {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url, bio, weekly_goal")
    .eq("id", userId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile) return null;

  const { data: rows, error } = await supabase
    .from("checkins")
    .select("id, occurred_on, duration_min, points_awarded, over_limit, source, photo_url, caption, exercise:exercise_types(name, icon)")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId)
    .order("occurred_on", { ascending: false });
  if (error) throw error;

  const list = (rows ?? []) as any[];
  const totalPoints = list.reduce((a, r) => a + (r.points_awarded ?? 0), 0);
  const countedDaysSet = new Set(list.filter((r) => !r.over_limit).map((r) => r.occurred_on));
  const extras = list.filter((r) => r.over_limit).length;
  const totalMinutes = list.reduce((a, r) => a + (r.duration_min ?? 0), 0);
  const { current, longest } = computeStreaks(Array.from(countedDaysSet));

  const paths = Array.from(new Set(list.map((r) => r.photo_url).filter(Boolean) as string[]));
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const results = await Promise.all(
      paths.map((p) =>
        supabase.storage
          .from("checkin-photos")
          .createSignedUrl(p, 60 * 60, { transform: { width: 800, quality: 75, resize: "contain" } })
          .then((r) => ({ path: p, url: r.data?.signedUrl ?? null })),
      ),
    );
    results.forEach((r) => {
      if (r.url) signedByPath.set(r.path, r.url);
    });
  }

  return {
    profile,
    totalPoints,
    countedDays: countedDaysSet.size,
    extraCheckins: extras,
    totalMinutes,
    currentStreak: current,
    longestStreak: longest,
    history: list.map((r) => ({
      id: r.id,
      occurred_on: r.occurred_on,
      duration_min: r.duration_min,
      points_awarded: r.points_awarded,
      over_limit: r.over_limit,
      source: r.source,
      photo_url: r.photo_url,
      photo_signed_url: r.photo_url ? signedByPath.get(r.photo_url) ?? null : null,
      caption: r.caption,
      exercise: r.exercise ?? null,
    })),
  };
}

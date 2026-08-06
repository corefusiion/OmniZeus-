-- Perf: covering indexes for the hottest queries surfaced by pg_stat_statements

-- exercise_types filtered by challenge_id, ordered by sort_order (543 calls)
CREATE INDEX IF NOT EXISTS idx_exercise_types_challenge_sort
  ON public.exercise_types (challenge_id, sort_order);

-- checkins by user for profile page / user timeline (was seq-scanning; existing idx is (user_id, occurred_on))
CREATE INDEX IF NOT EXISTS idx_checkins_user_created
  ON public.checkins (user_id, created_at DESC);

-- challenge_members lookup by user_id alone (PK is (challenge_id, user_id) — doesn't help user-first filters)
CREATE INDEX IF NOT EXISTS idx_challenge_members_user
  ON public.challenge_members (user_id);

-- challenges listing active by start date (explore / active challenge queries)
CREATE INDEX IF NOT EXISTS idx_challenges_active_starts
  ON public.challenges (is_active, starts_at DESC);

-- challenges owned by user (owner_id filter)
CREATE INDEX IF NOT EXISTS idx_challenges_owner
  ON public.challenges (owner_id);

-- FK indexes that PostgREST joins rely on
CREATE INDEX IF NOT EXISTS idx_checkins_exercise_type
  ON public.checkins (exercise_type_id);

-- Notifications: link source lookup and duplicate detection
CREATE INDEX IF NOT EXISTS idx_notifications_source
  ON public.notifications (source_type, source_id);

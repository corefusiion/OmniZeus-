ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind = ANY (ARRAY[
    'mention','comment','reaction','ai_post','system','badge_earned',
    'checkin_flag','moderation','challenge',
    'poke','duel_invite','duel_accepted','duel_declined','duel_resolved',
    'follow'
  ]));
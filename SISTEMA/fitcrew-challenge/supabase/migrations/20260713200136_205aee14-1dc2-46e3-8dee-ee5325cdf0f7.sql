
DO $$
DECLARE
  _bot uuid := 'e63c8e12-1858-4f2d-8552-09592a6f5f6a';
  _sa1 uuid := 'ab097576-c210-4489-9d09-c67fb45092b2'; -- glfx20
  _sa2 uuid := 'e53c69ef-804a-4fdd-bad7-3bb845b072be'; -- jsgleisson
BEGIN
  -- 1) Preserve bot posts: null challenge_id for bot posts pointing to challenges owned by users about to be deleted
  UPDATE public.posts p
     SET challenge_id = NULL
   FROM public.challenges c
   WHERE p.user_id = _bot
     AND p.challenge_id = c.id
     AND (c.owner_id IS NULL OR c.owner_id NOT IN (_bot, _sa1, _sa2));

  -- 2) Delete all challenges NOT owned by kept accounts (cascades: members, checkins, comments, reactions, duels, stories, messages, exercises, moderation audit, participants, daily_poses, absences, reports)
  DELETE FROM public.challenges
   WHERE owner_id IS NULL
      OR owner_id NOT IN (_bot, _sa1, _sa2);

  -- 3) Delete auth.users NOT in kept set (cascades to profiles, posts, mentions, follows, notifications, reactions, comments, fitcoin_transactions, ai logs, body metrics, etc.)
  DELETE FROM auth.users
   WHERE id NOT IN (_bot, _sa1, _sa2);

  -- 4) Bump FitCoin balance for the two Super Admins
  UPDATE public.profiles
     SET fitcoins_balance = 999999
   WHERE id IN (_sa1, _sa2);

  -- 5) Clean any lingering orphan rows in fitcoin_transactions is unnecessary (cascaded), but ensure withdraw requests cleared for safety
  DELETE FROM public.withdraw_requests WHERE user_id NOT IN (_bot, _sa1, _sa2);
END $$;

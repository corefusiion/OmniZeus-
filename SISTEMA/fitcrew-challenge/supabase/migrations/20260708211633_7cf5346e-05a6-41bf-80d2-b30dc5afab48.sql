
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_handle TEXT,
  ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT
    '{"checkin":true,"comment":true,"reaction":true,"chat":true,"winners":true,"mention":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS blocked_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- Handle length constraints (via triggers to stay safe with future edits)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_instagram_handle_len,
  DROP CONSTRAINT IF EXISTS profiles_tiktok_handle_len,
  DROP CONSTRAINT IF EXISTS profiles_twitter_handle_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_instagram_handle_len CHECK (instagram_handle IS NULL OR char_length(instagram_handle) BETWEEN 1 AND 50),
  ADD CONSTRAINT profiles_tiktok_handle_len CHECK (tiktok_handle IS NULL OR char_length(tiktok_handle) BETWEEN 1 AND 50),
  ADD CONSTRAINT profiles_twitter_handle_len CHECK (twitter_handle IS NULL OR char_length(twitter_handle) BETWEEN 1 AND 50);

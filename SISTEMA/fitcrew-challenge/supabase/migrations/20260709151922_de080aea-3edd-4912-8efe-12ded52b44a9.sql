
-- Normaliza timestamps de seed que ficaram no futuro (checkins e comentários)
UPDATE public.checkins SET created_at = now() - interval '1 minute' * (extract(epoch from (created_at - now()))/60 + 60) WHERE created_at > now();
UPDATE public.checkin_comments SET created_at = now() - interval '30 seconds' WHERE created_at > now();
UPDATE public.post_comments SET created_at = now() - interval '30 seconds' WHERE created_at > now();
UPDATE public.posts SET created_at = now() - interval '30 seconds' WHERE created_at > now();

DELETE FROM public.ai_coach_messages
WHERE user_id = '674e56eb-0290-4e60-9475-818089cc9b18'
  AND role = 'user'
  AND created_at >= date_trunc('day', now());
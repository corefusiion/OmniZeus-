CREATE POLICY "Public challenge banners are viewable by anon"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'challenge-banners'
  AND EXISTS (
    SELECT 1
    FROM public.challenges c
    WHERE c.id = ((storage.foldername(name))[1])::uuid
      AND c.is_public = true
      AND c.is_active = true
  )
);
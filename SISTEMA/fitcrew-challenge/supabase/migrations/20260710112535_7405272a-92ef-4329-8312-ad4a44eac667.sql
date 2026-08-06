-- Allow challenge admins to INSERT into their own challenge folder
CREATE POLICY "Challenge admins can upload banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'challenge-banners'
  AND public.is_challenge_admin(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- Allow challenge admins to DELETE from their own challenge folder
CREATE POLICY "Challenge admins can delete banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'challenge-banners'
  AND public.is_challenge_admin(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

-- Allow challenge admins to UPDATE (upsert) their own banners
CREATE POLICY "Challenge admins can update banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'challenge-banners'
  AND public.is_challenge_admin(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
)
WITH CHECK (
  bucket_id = 'challenge-banners'
  AND public.is_challenge_admin(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);
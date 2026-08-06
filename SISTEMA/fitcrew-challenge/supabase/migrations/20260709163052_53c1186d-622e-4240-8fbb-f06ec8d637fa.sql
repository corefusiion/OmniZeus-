
CREATE POLICY "Authenticated can read challenge banners"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'challenge-banners');

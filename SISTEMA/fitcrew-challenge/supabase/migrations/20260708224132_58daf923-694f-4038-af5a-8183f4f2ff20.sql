
CREATE POLICY "body-scan owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'body-scan-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "body-scan owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'body-scan-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "body-scan owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'body-scan-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "body-scan owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'body-scan-media' AND auth.uid()::text = (storage.foldername(name))[1]);

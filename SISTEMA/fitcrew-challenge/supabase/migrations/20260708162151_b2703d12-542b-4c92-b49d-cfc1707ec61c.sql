
CREATE POLICY "Checkin photos viewable by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'checkin-photos');
CREATE POLICY "Users upload own checkin photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'checkin-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete own checkin photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'checkin-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

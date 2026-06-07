-- ========================================
-- Pickleball App — Storage policies (bucket `avatars`)
-- LƯU Ý: tạo bucket trong UI trước (Storage → New bucket → "avatars" → Public)
-- Sau đó chạy file này
-- ========================================

-- Anyone authenticated can READ avatar
DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- User upload chỉ vào folder của member họ
-- Path format: avatars/{member_id}/{timestamp}.webp
DROP POLICY IF EXISTS avatars_write_own ON storage.objects;
CREATE POLICY avatars_write_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.members WHERE user_id = auth.uid()
    )
  );

-- Admin có toàn quyền với avatars
DROP POLICY IF EXISTS avatars_admin_all ON storage.objects;
CREATE POLICY avatars_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

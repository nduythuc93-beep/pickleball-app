-- ========================================
-- Fix: storage policies + ensure is_coach/is_host + reload cache
-- Chạy nếu admin không upload được avatar cho member khác,
-- hoặc UPDATE member trả 400
-- ========================================

-- 1. Ensure is_coach + is_host columns exist
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_coach boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_host  boolean NOT NULL DEFAULT false;

-- 2. Ensure is_admin() function exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid() AND is_admin = true AND is_active = true
  );
$$;

-- 3. Drop và recreate TẤT CẢ storage policies
DROP POLICY IF EXISTS avatars_read ON storage.objects;
DROP POLICY IF EXISTS avatars_write_own ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
DROP POLICY IF EXISTS avatars_admin_all ON storage.objects;

-- SELECT cho mọi authenticated user
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- INSERT: user upload vào folder của chính mình
CREATE POLICY avatars_write_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.members WHERE user_id = auth.uid()
    )
  );

-- UPDATE: cho phép overwrite file cũ
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.members WHERE user_id = auth.uid()
    )
  );

-- DELETE: xoá file cũ trước khi upload mới
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.members WHERE user_id = auth.uid()
    )
  );

-- Admin: TOÀN QUYỀN trên bucket avatars (FOR ALL = SELECT/INSERT/UPDATE/DELETE)
CREATE POLICY avatars_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 5. Verify
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
-- Phải show 5 policies: avatars_admin_all, avatars_delete_own,
-- avatars_read, avatars_update_own, avatars_write_own

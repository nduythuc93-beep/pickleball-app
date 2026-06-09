-- ========================================
-- Walk-in: thêm is_paid + delete policy
-- Bỏ Chai nước reward
-- ========================================

-- 1. Add columns vào walk_in_checkins
ALTER TABLE walk_in_checkins
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. UPDATE policy: host/admin có thể mark paid
DROP POLICY IF EXISTS walkin_update_admin ON walk_in_checkins;
CREATE POLICY walkin_update_admin ON walk_in_checkins FOR UPDATE
  TO authenticated
  USING (public.is_host_or_admin())
  WITH CHECK (public.is_host_or_admin());

-- 3. DELETE policy: host/admin có thể xoá
DROP POLICY IF EXISTS walkin_delete_admin ON walk_in_checkins;
CREATE POLICY walkin_delete_admin ON walk_in_checkins FOR DELETE
  TO authenticated
  USING (public.is_host_or_admin());

-- 4. Ẩn Chai nước (Member mới) khỏi catalog
UPDATE rewards SET is_active = false
WHERE name LIKE '%Chai nước (Member mới)%';

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'walkin policies' AS check, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'walk_in_checkins';

SELECT 'Chai nước status' AS check, name, is_active
FROM rewards
WHERE name LIKE '%Chai nước%';

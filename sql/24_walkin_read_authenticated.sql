-- ========================================
-- Cho phép tất cả authenticated members đọc walk_in_checkins
-- (để hiện trong attendee list của SessionDetailPage)
-- ========================================

DROP POLICY IF EXISTS walkin_read_admin ON walk_in_checkins;
DROP POLICY IF EXISTS walkin_read_all ON walk_in_checkins;

CREATE POLICY walkin_read_all ON walk_in_checkins FOR SELECT
  TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';

SELECT policyname, roles, cmd FROM pg_policies
WHERE tablename = 'walk_in_checkins';

-- ========================================
-- Cho phép anon (vãng lai chưa login) đọc public tables
-- - play_sessions, tournaments, rewards, activity_types, session_schedules
-- - members, walk_in_checkins giữ private
-- ========================================

DROP POLICY IF EXISTS ps_read ON play_sessions;
CREATE POLICY ps_read ON play_sessions FOR SELECT
  TO authenticated, anon USING (true);

DROP POLICY IF EXISTS tournaments_select_all ON tournaments;
CREATE POLICY tournaments_select_all ON tournaments FOR SELECT
  TO authenticated, anon USING (true);

DROP POLICY IF EXISTS rewards_read ON rewards;
CREATE POLICY rewards_read ON rewards FOR SELECT
  TO authenticated, anon USING (true);

DROP POLICY IF EXISTS at_read ON activity_types;
CREATE POLICY at_read ON activity_types FOR SELECT
  TO authenticated, anon USING (true);

DROP POLICY IF EXISTS sch_read ON session_schedules;
CREATE POLICY sch_read ON session_schedules FOR SELECT
  TO authenticated, anon USING (true);

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT tablename, policyname, roles
FROM pg_policies
WHERE tablename IN ('play_sessions', 'tournaments', 'rewards', 'activity_types', 'session_schedules')
  AND cmd = 'SELECT'
ORDER BY tablename;

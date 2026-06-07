-- ========================================
-- Pickleball App — Row Level Security
-- Chạy SAU 01_schema.sql
-- ========================================

-- Enable RLS trên tất cả tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- ========================================
-- HELPER FUNCTION: check current user is admin
-- ========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
      AND is_admin = true
      AND is_active = true
  );
$$;

-- ========================================
-- MEMBERS
-- ========================================
DROP POLICY IF EXISTS members_select_all ON members;
CREATE POLICY members_select_all ON members
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS members_update_own ON members;
CREATE POLICY members_update_own ON members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS members_admin_all ON members;
CREATE POLICY members_admin_all ON members
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ========================================
-- SURVEYS
-- ========================================
DROP POLICY IF EXISTS surveys_select_all ON surveys;
CREATE POLICY surveys_select_all ON surveys
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS surveys_admin_write ON surveys;
CREATE POLICY surveys_admin_write ON surveys
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ========================================
-- SURVEY RESPONSES
-- ========================================
DROP POLICY IF EXISTS responses_select_all ON survey_responses;
CREATE POLICY responses_select_all ON survey_responses
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS responses_insert_own ON survey_responses;
CREATE POLICY responses_insert_own ON survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS responses_admin_all ON survey_responses;
CREATE POLICY responses_admin_all ON survey_responses
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ========================================
-- TOURNAMENTS
-- ========================================
DROP POLICY IF EXISTS tournaments_select_all ON tournaments;
CREATE POLICY tournaments_select_all ON tournaments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS tournaments_admin_write ON tournaments;
CREATE POLICY tournaments_admin_write ON tournaments
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ========================================
-- TOURNAMENT REGISTRATIONS
-- ========================================
DROP POLICY IF EXISTS regs_select_all ON tournament_registrations;
CREATE POLICY regs_select_all ON tournament_registrations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS regs_insert_own ON tournament_registrations;
CREATE POLICY regs_insert_own ON tournament_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS regs_admin_all ON tournament_registrations;
CREATE POLICY regs_admin_all ON tournament_registrations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ========================================
-- TOURNAMENT MATCHES
-- ========================================
DROP POLICY IF EXISTS matches_select_all ON tournament_matches;
CREATE POLICY matches_select_all ON tournament_matches
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS matches_admin_write ON tournament_matches;
CREATE POLICY matches_admin_write ON tournament_matches
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ========================================
-- DONE
-- ========================================
-- Check policies:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

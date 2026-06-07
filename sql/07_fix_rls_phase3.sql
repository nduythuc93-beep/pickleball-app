-- ========================================
-- Phase 3: Fix RLS for surveys/responses/tournaments
-- + reload schema cache cho is_coach/is_host columns
-- Chạy nếu lỗi "violates RLS policy" trên surveys, hoặc "column not found"
-- ========================================

-- 1. Ensure is_admin() exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid() AND is_admin = true AND is_active = true
  );
$$;

-- 2. Enable RLS
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- 3. SURVEYS
DROP POLICY IF EXISTS surveys_select_all ON surveys;
DROP POLICY IF EXISTS surveys_admin_write ON surveys;
DROP POLICY IF EXISTS surveys_admin_insert ON surveys;
DROP POLICY IF EXISTS surveys_admin_update ON surveys;
DROP POLICY IF EXISTS surveys_admin_delete ON surveys;

CREATE POLICY surveys_select_all ON surveys FOR SELECT TO authenticated USING (true);
CREATE POLICY surveys_admin_insert ON surveys FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY surveys_admin_update ON surveys FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY surveys_admin_delete ON surveys FOR DELETE TO authenticated USING (public.is_admin());

-- 4. SURVEY_RESPONSES
DROP POLICY IF EXISTS responses_select_all ON survey_responses;
DROP POLICY IF EXISTS responses_insert_own ON survey_responses;
DROP POLICY IF EXISTS responses_admin_all ON survey_responses;
DROP POLICY IF EXISTS responses_update_own ON survey_responses;
DROP POLICY IF EXISTS responses_delete_admin ON survey_responses;

CREATE POLICY responses_select_all ON survey_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY responses_insert_own ON survey_responses FOR INSERT TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
CREATE POLICY responses_update_own ON survey_responses FOR UPDATE TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR public.is_admin())
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY responses_delete_admin ON survey_responses FOR DELETE TO authenticated USING (public.is_admin());

-- 5. TOURNAMENTS (sẵn cho Phase 4)
DROP POLICY IF EXISTS tournaments_select_all ON tournaments;
DROP POLICY IF EXISTS tournaments_admin_write ON tournaments;
DROP POLICY IF EXISTS tournaments_admin_insert ON tournaments;
DROP POLICY IF EXISTS tournaments_admin_update ON tournaments;
DROP POLICY IF EXISTS tournaments_admin_delete ON tournaments;
CREATE POLICY tournaments_select_all ON tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY tournaments_admin_insert ON tournaments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY tournaments_admin_update ON tournaments FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY tournaments_admin_delete ON tournaments FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS regs_select_all ON tournament_registrations;
DROP POLICY IF EXISTS regs_insert_own ON tournament_registrations;
DROP POLICY IF EXISTS regs_admin_all ON tournament_registrations;
CREATE POLICY regs_select_all ON tournament_registrations FOR SELECT TO authenticated USING (true);
CREATE POLICY regs_insert_own ON tournament_registrations FOR INSERT TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR public.is_admin());
CREATE POLICY regs_admin_all ON tournament_registrations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS matches_select_all ON tournament_matches;
DROP POLICY IF EXISTS matches_admin_write ON tournament_matches;
CREATE POLICY matches_select_all ON tournament_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY matches_admin_write ON tournament_matches FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

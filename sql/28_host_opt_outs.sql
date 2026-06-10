-- ========================================
-- P0 fixes:
-- 1. Host opt-out: khi Host huỷ check-in social session, ghi opt-out để
--    auto-checkin effect KHÔNG re-create lại
-- 2. Index walk_in_checkins(session_id) — query thường xuyên ở
--    HomePage + SessionsPage để đếm walk-in per session
-- ========================================

-- 1. Table session_host_opt_outs
CREATE TABLE IF NOT EXISTS session_host_opt_outs (
  session_id   uuid NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_opt_outs_member
  ON session_host_opt_outs(member_id);

-- 2. RLS — user chỉ thấy/sửa opt-out của mình
ALTER TABLE session_host_opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opt_outs_select_own ON session_host_opt_outs;
DROP POLICY IF EXISTS opt_outs_insert_own ON session_host_opt_outs;
DROP POLICY IF EXISTS opt_outs_delete_own ON session_host_opt_outs;

CREATE POLICY opt_outs_select_own ON session_host_opt_outs
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- Admin có thể xem hết (debug)
DROP POLICY IF EXISTS opt_outs_admin_all ON session_host_opt_outs;
CREATE POLICY opt_outs_admin_all ON session_host_opt_outs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY opt_outs_insert_own ON session_host_opt_outs
  FOR INSERT TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY opt_outs_delete_own ON session_host_opt_outs
  FOR DELETE TO authenticated
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- 3. Trigger: khi member INSERT check-in mới → xoá opt-out cũ
-- (Tức là họ đã đổi ý, opt-in lại — không nên block lần sau)
CREATE OR REPLACE FUNCTION public.clear_opt_out_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM session_host_opt_outs
  WHERE session_id = NEW.session_id
    AND member_id  = NEW.member_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_opt_out_on_checkin ON session_checkins;
CREATE TRIGGER trg_clear_opt_out_on_checkin
  AFTER INSERT ON session_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_opt_out_on_checkin();

-- 4. Update cancel_my_checkin RPC: ghi opt-out cho Host khi huỷ social
CREATE OR REPLACE FUNCTION public.cancel_my_checkin(p_checkin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin session_checkins%ROWTYPE;
  v_session play_sessions%ROWTYPE;
  v_member  members%ROWTYPE;
  v_now timestamptz := now();
  v_penalty_threshold timestamptz;
  v_cancel_deadline timestamptz;
  v_current_points int;
  v_penalty int := 0;
BEGIN
  SELECT * INTO v_checkin FROM session_checkins WHERE id = p_checkin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in không tồn tại';
  END IF;

  IF NOT (
    v_checkin.member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.is_host_or_admin()
  ) THEN
    RAISE EXCEPTION 'Không có quyền huỷ check-in này';
  END IF;

  SELECT * INTO v_session FROM play_sessions WHERE id = v_checkin.session_id;
  SELECT * INTO v_member  FROM members        WHERE id = v_checkin.member_id;

  v_penalty_threshold := (v_session.session_date::text || ' ' || v_session.start_time::text)::timestamptz - interval '3 hours';
  v_cancel_deadline   := (v_session.session_date::text || ' ' || v_session.start_time::text)::timestamptz + interval '1 hour';

  IF v_now > v_cancel_deadline THEN
    RAISE EXCEPTION 'Đã quá 1h sau giờ bắt đầu — không thể huỷ';
  END IF;

  IF v_now > v_penalty_threshold THEN
    SELECT total_points INTO v_current_points FROM members WHERE id = v_checkin.member_id;
    v_penalty := LEAST(10, COALESCE(v_current_points, 0));
    IF v_penalty > 0 THEN
      UPDATE members SET total_points = total_points - v_penalty
      WHERE id = v_checkin.member_id;
    END IF;
  END IF;

  DELETE FROM session_checkins WHERE id = p_checkin_id;

  -- ❗ Track host opt-out: Host huỷ social session → block auto-checkin
  IF v_member.is_host AND v_session.activity_type = 'social' THEN
    INSERT INTO session_host_opt_outs (session_id, member_id)
    VALUES (v_checkin.session_id, v_checkin.member_id)
    ON CONFLICT (session_id, member_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'penalty', v_penalty,
    'within_penalty_window', v_now > v_penalty_threshold,
    'opted_out', v_member.is_host AND v_session.activity_type = 'social'
  );
END;
$$;

-- 5. Index thiếu cho walk_in_checkins (HomePage/SessionsPage query rất nhiều)
CREATE INDEX IF NOT EXISTS idx_walkin_session
  ON walk_in_checkins(session_id) WHERE session_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'session_host_opt_outs' AS table_name, COUNT(*) AS rows
FROM session_host_opt_outs;

SELECT 'walk-in index' AS check, indexname
FROM pg_indexes
WHERE tablename = 'walk_in_checkins' AND indexname = 'idx_walkin_session';

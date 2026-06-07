-- ========================================
-- Phase A.1: RPC huỷ check-in với penalty
-- - Huỷ TRƯỚC 3h trước session_start: free
-- - Huỷ TRONG VÒNG 3h trước session_start: trừ 5 điểm (nếu có)
-- ========================================

CREATE OR REPLACE FUNCTION public.cancel_my_checkin(p_checkin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin session_checkins%ROWTYPE;
  v_session play_sessions%ROWTYPE;
  v_now timestamptz := now();
  v_penalty_threshold timestamptz;
  v_current_points int;
  v_penalty int := 0;
BEGIN
  -- 1. Get checkin
  SELECT * INTO v_checkin FROM session_checkins WHERE id = p_checkin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in không tồn tại';
  END IF;

  -- 2. Permission: own checkin OR host/admin
  IF NOT (
    v_checkin.member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.is_host_or_admin()
  ) THEN
    RAISE EXCEPTION 'Không có quyền huỷ check-in này';
  END IF;

  -- 3. Get session để check thời gian
  SELECT * INTO v_session FROM play_sessions WHERE id = v_checkin.session_id;
  v_penalty_threshold := (v_session.session_date::text || ' ' || v_session.start_time::text)::timestamptz - interval '3 hours';

  -- 4. Nếu huỷ trong 3h trước session start → trừ 5 điểm
  IF v_now > v_penalty_threshold THEN
    SELECT total_points INTO v_current_points FROM members WHERE id = v_checkin.member_id;
    v_penalty := LEAST(5, COALESCE(v_current_points, 0));
    IF v_penalty > 0 THEN
      UPDATE members SET total_points = total_points - v_penalty
      WHERE id = v_checkin.member_id;
    END IF;
  END IF;

  -- 5. Delete checkin
  DELETE FROM session_checkins WHERE id = p_checkin_id;

  RETURN json_build_object(
    'penalty', v_penalty,
    'within_penalty_window', v_now > v_penalty_threshold
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_checkin(uuid) TO authenticated;

-- Notify reload
NOTIFY pgrst, 'reload schema';

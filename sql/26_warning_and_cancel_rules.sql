-- ========================================
-- Update rules:
-- 1. Cancel rules:
--    - Trước 3h trước start: free
--    - -3h → +1h sau start: trừ 10 điểm
--    - Sau +1h từ start: KHÔNG cho huỷ
-- 2. Cảnh cáo (warning): Host/Admin mark member checked-in nhưng không tham gia
--    → trừ 50% session points
-- ========================================

-- 1. Add columns vào session_checkins cho warning
ALTER TABLE session_checkins
  ADD COLUMN IF NOT EXISTS is_warned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warned_at timestamptz,
  ADD COLUMN IF NOT EXISTS warned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Update cancel_my_checkin: 10đ penalty + cancel deadline +1h
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
  v_penalty_threshold := (v_session.session_date::text || ' ' || v_session.start_time::text)::timestamptz - interval '3 hours';
  v_cancel_deadline := (v_session.session_date::text || ' ' || v_session.start_time::text)::timestamptz + interval '1 hour';

  -- Sau 1h từ lúc bắt đầu: KHÔNG cho huỷ
  IF v_now > v_cancel_deadline THEN
    RAISE EXCEPTION 'Đã quá 1h sau giờ bắt đầu — không thể huỷ';
  END IF;

  -- Trong vùng penalty: trừ 10 điểm
  IF v_now > v_penalty_threshold THEN
    SELECT total_points INTO v_current_points FROM members WHERE id = v_checkin.member_id;
    v_penalty := LEAST(10, COALESCE(v_current_points, 0));
    IF v_penalty > 0 THEN
      UPDATE members SET total_points = total_points - v_penalty
      WHERE id = v_checkin.member_id;
    END IF;
  END IF;

  DELETE FROM session_checkins WHERE id = p_checkin_id;

  RETURN json_build_object(
    'penalty', v_penalty,
    'within_penalty_window', v_now > v_penalty_threshold
  );
END;
$$;

-- 3. RPC mark_checkin_warned: trừ 50% session points
CREATE OR REPLACE FUNCTION public.mark_checkin_warned(p_checkin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin session_checkins%ROWTYPE;
  v_session play_sessions%ROWTYPE;
  v_penalty int;
  v_current_points int;
BEGIN
  IF NOT public.is_host_or_admin() THEN
    RAISE EXCEPTION 'Chỉ Host/Admin được cảnh cáo';
  END IF;

  SELECT * INTO v_checkin FROM session_checkins WHERE id = p_checkin_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Check-in không tồn tại';
  END IF;

  IF v_checkin.is_warned THEN
    RAISE EXCEPTION 'Đã cảnh cáo rồi';
  END IF;

  SELECT * INTO v_session FROM play_sessions WHERE id = v_checkin.session_id;

  -- Tính 50% session points (round up)
  v_penalty := CEIL(v_session.points_award::numeric * 0.5)::int;

  -- Cap by member's current points (không thể trừ âm)
  SELECT total_points INTO v_current_points FROM members WHERE id = v_checkin.member_id;
  v_penalty := LEAST(v_penalty, COALESCE(v_current_points, 0));

  IF v_penalty > 0 THEN
    UPDATE members SET total_points = total_points - v_penalty
    WHERE id = v_checkin.member_id;
  END IF;

  -- Mark warned (không xoá checkin)
  UPDATE session_checkins
  SET is_warned = true, warned_at = now(), warned_by = auth.uid()
  WHERE id = p_checkin_id;

  RETURN json_build_object(
    'penalty', v_penalty,
    'session_points', v_session.points_award
  );
END;
$$;

-- 4. RPC undo warning (admin only, nếu cảnh cáo nhầm)
CREATE OR REPLACE FUNCTION public.undo_checkin_warning(p_checkin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin session_checkins%ROWTYPE;
  v_session play_sessions%ROWTYPE;
  v_refund int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ Admin được undo cảnh cáo';
  END IF;

  SELECT * INTO v_checkin FROM session_checkins WHERE id = p_checkin_id;
  IF NOT FOUND OR NOT v_checkin.is_warned THEN
    RAISE EXCEPTION 'Không có cảnh cáo để undo';
  END IF;

  SELECT * INTO v_session FROM play_sessions WHERE id = v_checkin.session_id;
  v_refund := CEIL(v_session.points_award::numeric * 0.5)::int;

  -- Hoàn điểm
  UPDATE members SET total_points = total_points + v_refund
  WHERE id = v_checkin.member_id;

  -- Reset warned status
  UPDATE session_checkins
  SET is_warned = false, warned_at = NULL, warned_by = NULL
  WHERE id = p_checkin_id;

  RETURN json_build_object('refunded', v_refund);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_checkin_warned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_checkin_warning(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

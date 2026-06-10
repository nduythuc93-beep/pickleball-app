-- ========================================
-- CRITICAL FIXES cho gamification flow (case study của app)
-- ========================================
-- Bug #1: Free cancel → re-checkin → infinite points farming
--   Cause: Trigger update_member_points_on_checkin KHÔNG trừ trên DELETE
--   Effect: User cứ check-in (+10) → cancel free → check-in (+10) → cancel → vô hạn
--
-- Bug #2: Warning + Undo → user nhận free points
--   Cause: undo_checkin_warning luôn refund LEAST(50%, x), nhưng mark_checkin_warned
--          chỉ trừ LEAST(50%, current_points). Nếu current_points lúc warn = 0 thì
--          trừ 0, lúc undo refund full 50%.
--   Effect: User có 0đ → host warn → undo → user nhận miễn phí 5đ
--
-- Bug #3: Trigger không cap về 0 (có thể âm)
--
-- Missing feature: Khi member redeem reward, admin/host không được notify
--
-- Plan:
-- 1. Trigger trừ points trên DELETE (cap >= 0)
-- 2. Thêm column session_checkins.warned_penalty để track penalty thực tế
-- 3. Update mark_checkin_warned + undo_checkin_warning để refund đúng số đã trừ
-- 4. Thêm trigger notify_admins_redemption khi member đổi quà

-- ============================================================
-- 1. Update trigger: trừ điểm khi DELETE + cap >= 0
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_member_points_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE members
    SET total_points = GREATEST(0, total_points + COALESCE(NEW.points_awarded, 0))
    WHERE id = NEW.member_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' AND NEW.points_awarded IS DISTINCT FROM OLD.points_awarded THEN
    UPDATE members
    SET total_points = GREATEST(
      0,
      total_points + (COALESCE(NEW.points_awarded, 0) - COALESCE(OLD.points_awarded, 0))
    )
    WHERE id = NEW.member_id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- ❗ FIX BUG #1: trả lại điểm khi xoá check-in
    -- (cancel, admin xoá, ...) — đảm bảo không farming
    UPDATE members
    SET total_points = GREATEST(0, total_points - COALESCE(OLD.points_awarded, 0))
    WHERE id = OLD.member_id;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_member_points ON session_checkins;
CREATE TRIGGER trg_update_member_points
  AFTER INSERT OR UPDATE OR DELETE ON session_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_member_points_on_checkin();

-- ============================================================
-- 2. Thêm column track penalty cảnh cáo thực tế
-- ============================================================
ALTER TABLE session_checkins
  ADD COLUMN IF NOT EXISTS warned_penalty int DEFAULT 0;

-- ============================================================
-- 3. Update mark_checkin_warned: store actual penalty
-- ============================================================
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

  -- 50% session points (round up)
  v_penalty := CEIL(v_session.points_award::numeric * 0.5)::int;

  -- Cap by member's current points
  SELECT total_points INTO v_current_points FROM members WHERE id = v_checkin.member_id;
  v_penalty := LEAST(v_penalty, COALESCE(v_current_points, 0));

  IF v_penalty > 0 THEN
    UPDATE members
    SET total_points = GREATEST(0, total_points - v_penalty)
    WHERE id = v_checkin.member_id;
  END IF;

  -- ❗ FIX BUG #2: store the ACTUAL penalty deducted so undo refunds same amount
  UPDATE session_checkins
  SET is_warned      = true,
      warned_at      = now(),
      warned_by      = auth.uid(),
      warned_penalty = v_penalty
  WHERE id = p_checkin_id;

  RETURN json_build_object(
    'penalty',        v_penalty,
    'session_points', v_session.points_award
  );
END;
$$;

-- ============================================================
-- 4. Update undo_checkin_warning: refund STORED amount
-- ============================================================
CREATE OR REPLACE FUNCTION public.undo_checkin_warning(p_checkin_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin session_checkins%ROWTYPE;
  v_refund int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ Admin được undo cảnh cáo';
  END IF;

  SELECT * INTO v_checkin FROM session_checkins WHERE id = p_checkin_id;
  IF NOT FOUND OR NOT v_checkin.is_warned THEN
    RAISE EXCEPTION 'Không có cảnh cáo để undo';
  END IF;

  -- ❗ FIX BUG #2: refund EXACTLY what was deducted (was: refund 50% blindly)
  v_refund := COALESCE(v_checkin.warned_penalty, 0);

  IF v_refund > 0 THEN
    UPDATE members
    SET total_points = total_points + v_refund
    WHERE id = v_checkin.member_id;
  END IF;

  UPDATE session_checkins
  SET is_warned      = false,
      warned_at      = NULL,
      warned_by      = NULL,
      warned_penalty = 0
  WHERE id = p_checkin_id;

  RETURN json_build_object('refunded', v_refund);
END;
$$;

-- ============================================================
-- 5. Trigger: notify admin + host khi member redeem reward
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admins_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_name text;
  v_body text;
BEGIN
  -- Chỉ notify cho pending (skip nếu insert delivered/cancelled — rare)
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_member_name
  FROM members WHERE id = NEW.member_id;

  v_body := COALESCE(v_member_name, '?') || ' đổi: ' || NEW.reward_name
            || ' (-' || NEW.cost_points || 'đ)';

  INSERT INTO notifications (recipient_member_id, type, title, body, related_url)
  SELECT
    id,
    'reward_redemption',
    '🎁 Đổi quà — chờ xác nhận',
    v_body,
    '/admin'
  FROM members
  WHERE (is_admin = true OR is_host = true) AND is_active = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_redemption ON reward_redemptions;
CREATE TRIGGER trg_notify_admins_redemption
  AFTER INSERT ON reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_redemption();

-- ============================================================
-- 6. Fix BUG #4: race condition trong redeem_reward (TOCTOU)
-- ============================================================
-- Trước: SELECT points → check → UPDATE. Hai request song song có thể
-- cùng pass check rồi cùng trừ → user có thể đổi quà 2 lần với điểm
-- không đủ, hoặc stock âm.
--
-- Sau: dùng atomic UPDATE ... WHERE total_points >= cost
-- Nếu affected_rows = 0 → không đủ điểm hoặc race lost.
CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_reward rewards%ROWTYPE;
  v_redemption_id uuid;
  v_affected int;
BEGIN
  SELECT id INTO v_member_id
  FROM members WHERE user_id = auth.uid() AND is_active = true;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy thành viên';
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Phần quà không tồn tại hoặc đã ngưng';
  END IF;

  -- Atomic deduct: chỉ trừ nếu đủ điểm. Race-safe.
  UPDATE members
  SET total_points = total_points - v_reward.cost_points
  WHERE id = v_member_id
    AND total_points >= v_reward.cost_points;
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'Không đủ điểm. Cần % điểm', v_reward.cost_points;
  END IF;

  -- Atomic stock decrement (only if stock is tracked)
  IF v_reward.stock IS NOT NULL THEN
    UPDATE rewards
    SET stock = stock - 1
    WHERE id = p_reward_id AND stock > 0;
    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected = 0 THEN
      -- Stock hết — hoàn lại điểm
      UPDATE members
      SET total_points = total_points + v_reward.cost_points
      WHERE id = v_member_id;
      RAISE EXCEPTION 'Phần quà đã hết hàng';
    END IF;
  END IF;

  INSERT INTO reward_redemptions (
    reward_id, member_id, cost_points, reward_name, status
  ) VALUES (
    p_reward_id, v_member_id, v_reward.cost_points, v_reward.name, 'pending'
  ) RETURNING id INTO v_redemption_id;

  RETURN json_build_object(
    'redemption_id', v_redemption_id,
    'cost_points',   v_reward.cost_points,
    'reward_name',   v_reward.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- ============================================================
-- 7. Optional: notify member khi reward được delivered
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_member_redemption_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    INSERT INTO notifications (recipient_member_id, type, title, body, related_url)
    VALUES (
      NEW.member_id,
      'reward_delivered',
      '✅ Quà đã sẵn sàng',
      NEW.reward_name || ' — nhận tại sân, liên hệ Host/Admin',
      '/redemptions'
    );
  ELSIF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    INSERT INTO notifications (recipient_member_id, type, title, body, related_url)
    VALUES (
      NEW.member_id,
      'reward_cancelled',
      '❌ Đổi quà bị huỷ',
      NEW.reward_name || ' — đã hoàn ' || NEW.cost_points || 'đ',
      '/redemptions'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_member_redemption_status ON reward_redemptions;
CREATE TRIGGER trg_notify_member_redemption_status
  AFTER UPDATE ON reward_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_member_redemption_status();

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verify
-- ============================================================
SELECT 'Triggers' AS check, tgname, tgrelid::regclass AS table_
FROM pg_trigger
WHERE tgname IN (
  'trg_update_member_points',
  'trg_notify_admins_redemption',
  'trg_notify_member_redemption_status'
)
ORDER BY tgname;

SELECT 'Column added' AS check,
       column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'session_checkins' AND column_name = 'warned_penalty';

-- ========================================
-- Phase C: Rewards system — đổi điểm lấy quà
-- ========================================

-- 1. Rewards catalog
CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  image_updated_at timestamptz,
  cost_points int NOT NULL CHECK (cost_points >= 0),
  stock int CHECK (stock IS NULL OR stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_active ON rewards(is_active) WHERE is_active = true;

-- 2. Redemptions
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid REFERENCES rewards(id) ON DELETE SET NULL,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  cost_points int NOT NULL,
  reward_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
  notes text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  delivered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_redemptions_member ON reward_redemptions(member_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON reward_redemptions(status);

-- 3. RLS
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rewards_read ON rewards;
DROP POLICY IF EXISTS rewards_admin_write ON rewards;
CREATE POLICY rewards_read ON rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY rewards_admin_write ON rewards FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS rr_read ON reward_redemptions;
DROP POLICY IF EXISTS rr_insert_self ON reward_redemptions;
DROP POLICY IF EXISTS rr_update_admin ON reward_redemptions;
DROP POLICY IF EXISTS rr_delete_admin ON reward_redemptions;

CREATE POLICY rr_read ON reward_redemptions FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.is_host_or_admin()
  );
CREATE POLICY rr_insert_self ON reward_redemptions FOR INSERT TO authenticated
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
CREATE POLICY rr_update_admin ON reward_redemptions FOR UPDATE TO authenticated
  USING (public.is_host_or_admin()) WITH CHECK (public.is_host_or_admin());
CREATE POLICY rr_delete_admin ON reward_redemptions FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4. RPC: redeem_reward
CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_reward rewards%ROWTYPE;
  v_current_points int;
  v_redemption_id uuid;
BEGIN
  SELECT id, COALESCE(total_points, 0)
  INTO v_member_id, v_current_points
  FROM members WHERE user_id = auth.uid() AND is_active = true;
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy thành viên';
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Phần quà không tồn tại hoặc đã ngưng';
  END IF;

  IF v_current_points < v_reward.cost_points THEN
    RAISE EXCEPTION 'Không đủ điểm. Bạn có % điểm, cần % điểm', v_current_points, v_reward.cost_points;
  END IF;

  IF v_reward.stock IS NOT NULL AND v_reward.stock <= 0 THEN
    RAISE EXCEPTION 'Phần quà đã hết hàng';
  END IF;

  -- Trừ điểm (trigger cho phép giảm)
  UPDATE members
  SET total_points = total_points - v_reward.cost_points
  WHERE id = v_member_id;

  -- Trừ stock nếu giới hạn
  IF v_reward.stock IS NOT NULL THEN
    UPDATE rewards SET stock = stock - 1 WHERE id = p_reward_id;
  END IF;

  -- Tạo redemption
  INSERT INTO reward_redemptions (
    reward_id, member_id, cost_points, reward_name, status
  ) VALUES (
    p_reward_id, v_member_id, v_reward.cost_points, v_reward.name, 'pending'
  ) RETURNING id INTO v_redemption_id;

  RETURN json_build_object(
    'redemption_id', v_redemption_id,
    'remaining_points', v_current_points - v_reward.cost_points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO authenticated;

-- 5. RPC: mark_redemption_delivered (host + admin)
CREATE OR REPLACE FUNCTION public.mark_redemption_delivered(p_redemption_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_host_or_admin() THEN
    RAISE EXCEPTION 'Chỉ Host/Admin được mark delivered';
  END IF;
  UPDATE reward_redemptions
  SET status = 'delivered',
      delivered_at = now(),
      delivered_by = auth.uid()
  WHERE id = p_redemption_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption không tồn tại hoặc không phải pending';
  END IF;
  RETURN json_build_object('status', 'delivered');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_redemption_delivered(uuid) TO authenticated;

-- 6. RPC: cancel_redemption (admin only, refund điểm + stock)
CREATE OR REPLACE FUNCTION public.cancel_redemption(p_redemption_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption reward_redemptions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ Admin được huỷ + refund';
  END IF;
  SELECT * INTO v_redemption FROM reward_redemptions WHERE id = p_redemption_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption không tồn tại';
  END IF;
  IF v_redemption.status = 'cancelled' THEN
    RAISE EXCEPTION 'Đã huỷ rồi';
  END IF;

  -- Refund điểm (admin → trigger không block)
  UPDATE members SET total_points = total_points + v_redemption.cost_points
  WHERE id = v_redemption.member_id;

  -- Refund stock
  IF v_redemption.reward_id IS NOT NULL THEN
    UPDATE rewards SET stock = stock + 1
    WHERE id = v_redemption.reward_id AND stock IS NOT NULL;
  END IF;

  -- Update status
  UPDATE reward_redemptions
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  WHERE id = p_redemption_id;

  RETURN json_build_object('refunded_points', v_redemption.cost_points);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_redemption(uuid) TO authenticated;

-- 7. Seed 5 rewards
INSERT INTO rewards (name, description, cost_points, stock, display_order)
VALUES
  ('Vệ sinh vợt miễn phí',
    'Vệ sinh + bảo dưỡng vợt miễn phí 1 lần',
    30, NULL, 1),
  ('Nước suối',
    'Chai nước suối 500ml',
    100, NULL, 2),
  ('Cuốn cán vợt',
    'Cuốn cán mới (overgrip) cho vợt',
    100, NULL, 3),
  ('Bóng Pickleball',
    'Bộ 3 quả bóng pickleball chuẩn thi đấu',
    350, 20, 4),
  ('Áo CLB',
    'Áo đồng phục CLB Pickleball',
    1000, 10, 5)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'Rewards seeded:' AS info, count(*) FROM rewards;
SELECT name, cost_points, stock, is_active FROM rewards ORDER BY display_order;

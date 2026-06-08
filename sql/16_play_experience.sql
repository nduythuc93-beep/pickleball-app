-- ========================================
-- Phase B.1: Add play_experience + trigger enforce skill permission
-- - members.play_experience: 'beginner' / 'under_6m' / 'over_6m'
-- - Skill chỉ Host/Admin/Coach được set (trigger enforce)
-- - Roles (is_admin/host/coach/active) chỉ Admin set
-- ========================================

-- 1. Add column
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS play_experience text
  CHECK (play_experience IN ('beginner', 'under_6m', 'over_6m'));

-- 2. Helper function: is host/admin/coach
CREATE OR REPLACE FUNCTION public.is_host_admin_or_coach()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
      AND (is_admin = true OR is_host = true OR is_coach = true)
      AND is_active = true
  );
$$;

-- 3. Trigger: enforce skill + role update permission
CREATE OR REPLACE FUNCTION public.enforce_member_update_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_host_admin_coach boolean;
  v_caller_is_admin boolean;
BEGIN
  -- Check caller role
  SELECT
    (COALESCE(is_admin, false) OR COALESCE(is_host, false) OR COALESCE(is_coach, false)),
    COALESCE(is_admin, false)
  INTO v_caller_is_host_admin_coach, v_caller_is_admin
  FROM members
  WHERE user_id = auth.uid()
  LIMIT 1;

  v_caller_is_host_admin_coach := COALESCE(v_caller_is_host_admin_coach, false);
  v_caller_is_admin := COALESCE(v_caller_is_admin, false);

  -- Skill level: chỉ host/admin/coach mới change được
  IF NOT v_caller_is_host_admin_coach
     AND NEW.skill_level IS DISTINCT FROM OLD.skill_level THEN
    NEW.skill_level := OLD.skill_level;
    NEW.skill_updated_by := OLD.skill_updated_by;
    NEW.skill_updated_at := OLD.skill_updated_at;
  END IF;

  -- Roles + is_active: chỉ admin mới change được
  IF NOT v_caller_is_admin THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_coach := OLD.is_coach;
    NEW.is_host := OLD.is_host;
    NEW.is_active := OLD.is_active;
  END IF;

  -- total_points: chỉ cho trigger update_member_points_on_checkin sửa
  -- (member không tự ý set điểm) — nhưng RPC cancel_my_checkin cũng đang sửa
  -- Để open cho admin recompute, bỏ qua check này cho admin
  IF NOT v_caller_is_admin AND NEW.total_points IS DISTINCT FROM OLD.total_points THEN
    -- Cho phép giảm điểm (penalty từ RPC), chặn tự ý tăng
    IF NEW.total_points > OLD.total_points THEN
      NEW.total_points := OLD.total_points;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_member_update_perm ON members;
CREATE TRIGGER enforce_member_update_perm
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_update_permission();

-- 4. Update RPC signup_member: thêm param p_experience
DROP FUNCTION IF EXISTS public.signup_member(text, text, text, text);

CREATE OR REPLACE FUNCTION public.signup_member(
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_experience text DEFAULT 'beginner'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_existing_id uuid;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email không được để trống';
  END IF;
  IF p_experience NOT IN ('beginner', 'under_6m', 'over_6m') THEN
    RAISE EXCEPTION 'Kinh nghiệm không hợp lệ';
  END IF;

  SELECT id INTO v_existing_id
  FROM members
  WHERE lower(email) = lower(p_email);

  IF v_existing_id IS NOT NULL THEN
    UPDATE members
    SET full_name = trim(p_full_name),
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        play_experience = p_experience,
        is_active = true
    WHERE id = v_existing_id;
    RETURN json_build_object('member_id', v_existing_id, 'created', false);
  END IF;

  -- Tạo mới — skill_level default 'C' (admin/host/coach sẽ đánh giá sau)
  INSERT INTO members (
    full_name, email, phone, play_experience,
    skill_level, is_active
  )
  VALUES (
    trim(p_full_name),
    lower(trim(p_email)),
    NULLIF(trim(p_phone), ''),
    p_experience,
    'C',
    true
  )
  RETURNING id INTO v_member_id;

  RETURN json_build_object('member_id', v_member_id, 'created', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_member(text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- 5. Verify
SELECT 'play_experience column' AS check,
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'members' AND column_name = 'play_experience';

SELECT 'Trigger' AS check, trigger_name
FROM information_schema.triggers
WHERE event_object_table = 'members' AND trigger_name = 'enforce_member_update_perm';

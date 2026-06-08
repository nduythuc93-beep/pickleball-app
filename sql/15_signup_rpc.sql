-- ========================================
-- Phase B: Self-signup RPC
-- Cho phép anon user tạo member record (bypass RLS qua SECURITY DEFINER)
-- Sau đó client tự signUp() hoặc signInWithOtp() để tạo auth user
-- Trigger handle_new_user (đã có ở sql/05) sẽ tự link user_id qua email
-- ========================================

CREATE OR REPLACE FUNCTION public.signup_member(
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
  p_skill_level text DEFAULT 'C'
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
  -- Validate
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email không được để trống';
  END IF;
  IF p_skill_level NOT IN ('A', 'B+', 'B-', 'C') THEN
    RAISE EXCEPTION 'Skill level không hợp lệ';
  END IF;

  -- Check email tồn tại chưa
  SELECT id INTO v_existing_id
  FROM members
  WHERE lower(email) = lower(p_email);

  IF v_existing_id IS NOT NULL THEN
    -- Email đã có → đánh dấu active lại (nếu bị tắt) + cập nhật info
    UPDATE members
    SET full_name = trim(p_full_name),
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        skill_level = p_skill_level,
        is_active = true
    WHERE id = v_existing_id;
    RETURN json_build_object('member_id', v_existing_id, 'created', false);
  END IF;

  -- Tạo mới
  INSERT INTO members (full_name, email, phone, skill_level, is_active)
  VALUES (
    trim(p_full_name),
    lower(trim(p_email)),
    NULLIF(trim(p_phone), ''),
    p_skill_level,
    true
  )
  RETURNING id INTO v_member_id;

  RETURN json_build_object('member_id', v_member_id, 'created', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_member(text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

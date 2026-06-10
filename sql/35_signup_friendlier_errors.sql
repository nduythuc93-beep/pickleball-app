-- ========================================
-- Signup error messages: friendlier + don't expose PII
-- ========================================

CREATE OR REPLACE FUNCTION public.signup_member(
  p_full_name text,
  p_email text,
  p_phone text,
  p_experience text DEFAULT 'beginner',
  p_gender text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_existing_id uuid;
  v_signup_bonus int := 20;
  v_walkin_count int := 0;
  v_is_new boolean := false;
  v_clean_phone text;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập họ tên';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập email';
  END IF;
  -- Basic email format: must contain @ and .
  IF position('@' IN p_email) = 0 OR position('.' IN split_part(p_email, '@', 2)) = 0 THEN
    RAISE EXCEPTION 'Email không hợp lệ';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập số điện thoại';
  END IF;
  IF NOT public.is_valid_vn_phone(p_phone) THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ — phải đủ 10 số bắt đầu bằng 0';
  END IF;
  v_clean_phone := regexp_replace(p_phone, '[\s\.\-\(\)]', '', 'g');

  IF p_experience NOT IN ('beginner', 'under_6m', 'over_6m') THEN
    RAISE EXCEPTION 'Kinh nghiệm chơi không hợp lệ';
  END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính không hợp lệ';
  END IF;

  -- Find existing member by email
  SELECT id INTO v_existing_id
  FROM members
  WHERE lower(email) = lower(trim(p_email));

  IF v_existing_id IS NOT NULL THEN
    -- Update existing (e.g. walk-in upgrading to member, or re-signup after auth failed)
    UPDATE members
    SET full_name = trim(p_full_name),
        phone = v_clean_phone,
        play_experience = p_experience,
        gender = COALESCE(p_gender, gender),
        is_active = true
    WHERE id = v_existing_id;
    v_member_id := v_existing_id;
  ELSE
    -- Phone uniqueness check — don't echo back the number (PII)
    IF EXISTS (
      SELECT 1 FROM members
      WHERE phone = v_clean_phone AND lower(email) != lower(trim(p_email))
    ) THEN
      RAISE EXCEPTION 'Số điện thoại này đã có tài khoản. Vui lòng đăng nhập hoặc dùng email khác.';
    END IF;

    INSERT INTO members (
      full_name, email, phone, play_experience, gender,
      skill_level, is_active, total_points
    )
    VALUES (
      trim(p_full_name),
      lower(trim(p_email)),
      v_clean_phone,
      p_experience,
      p_gender,
      '2.0',
      true,
      v_signup_bonus
    )
    RETURNING id INTO v_member_id;
    v_is_new := true;
  END IF;

  -- Auto-link walk-in history (same phone)
  UPDATE walk_in_checkins
  SET converted_to_member_id = v_member_id
  WHERE phone = v_clean_phone
    AND converted_to_member_id IS NULL;
  GET DIAGNOSTICS v_walkin_count = ROW_COUNT;

  RETURN json_build_object(
    'member_id',           v_member_id,
    'created',             v_is_new,
    'signup_bonus',        CASE WHEN v_is_new THEN v_signup_bonus ELSE 0 END,
    'linked_walkin_count', v_walkin_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_member(text, text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

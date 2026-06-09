-- ========================================
-- Phone required cho signup member
-- (walk-in đã có phone required từ trước)
-- ========================================

DROP FUNCTION IF EXISTS public.signup_member(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.signup_member(
  p_full_name text,
  p_email text,
  p_phone text,           -- ❗ KHÔNG còn default NULL — required
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
  -- Validate
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email không được để trống';
  END IF;
  -- ❗ Phone required + validate basic format
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Số điện thoại là bắt buộc';
  END IF;
  v_clean_phone := trim(p_phone);
  IF length(v_clean_phone) < 9 OR length(v_clean_phone) > 15 THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ (9-15 ký tự)';
  END IF;
  IF p_experience NOT IN ('beginner', 'under_6m', 'over_6m') THEN
    RAISE EXCEPTION 'Kinh nghiệm không hợp lệ';
  END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính không hợp lệ';
  END IF;

  -- Check email tồn tại
  SELECT id INTO v_existing_id
  FROM members
  WHERE lower(email) = lower(p_email);

  IF v_existing_id IS NOT NULL THEN
    -- Update existing (chấp nhận đổi phone nếu khác)
    UPDATE members
    SET full_name = trim(p_full_name),
        phone = v_clean_phone,
        play_experience = p_experience,
        gender = COALESCE(p_gender, gender),
        is_active = true
    WHERE id = v_existing_id;
    v_member_id := v_existing_id;
  ELSE
    -- Check phone đã tồn tại chưa (UNIQUE constraint sẽ block, nhưng raise friendly error trước)
    IF EXISTS (SELECT 1 FROM members WHERE phone = v_clean_phone) THEN
      RAISE EXCEPTION 'Số điện thoại % đã được đăng ký', v_clean_phone;
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
      'C',
      true,
      v_signup_bonus
    )
    RETURNING id INTO v_member_id;
    v_is_new := true;
  END IF;

  -- Auto-link walk-in records nếu SĐT giống
  UPDATE walk_in_checkins
  SET converted_to_member_id = v_member_id
  WHERE phone = v_clean_phone
    AND converted_to_member_id IS NULL;
  GET DIAGNOSTICS v_walkin_count = ROW_COUNT;

  RETURN json_build_object(
    'member_id', v_member_id,
    'created', v_is_new,
    'signup_bonus', CASE WHEN v_is_new THEN v_signup_bonus ELSE 0 END,
    'linked_walkin_count', v_walkin_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.signup_member(text, text, text, text, text)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'signup_member updated' AS check, prokind, prosecdef
FROM pg_proc WHERE proname = 'signup_member';

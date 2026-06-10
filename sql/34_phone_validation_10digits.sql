-- ========================================
-- Phone validation: exactly 10 digits starting with 0 (Vietnamese mobile)
-- Apply to: walk_in_checkin + signup_member RPCs
-- ========================================

-- Helper function: validate VN mobile phone
CREATE OR REPLACE FUNCTION public.is_valid_vn_phone(p_phone text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean text;
BEGIN
  IF p_phone IS NULL THEN RETURN false; END IF;
  -- Strip whitespace, dashes, dots, parentheses
  v_clean := regexp_replace(p_phone, '[\s\.\-\(\)]', '', 'g');
  -- Must be exactly 10 digits starting with 0
  RETURN v_clean ~ '^0[0-9]{9}$';
END;
$$;

-- Update walk_in_checkin with new validation
CREATE OR REPLACE FUNCTION public.walk_in_checkin(
  p_full_name text,
  p_phone text,
  p_referral_source text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing_member_id uuid;
  v_session_label text;
  v_clean_phone text;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập họ tên';
  END IF;

  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập số điện thoại';
  END IF;

  -- Strict 10-digit validation
  IF NOT public.is_valid_vn_phone(p_phone) THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ — phải đủ 10 số bắt đầu bằng 0';
  END IF;

  -- Normalize: strip non-digits, store clean
  v_clean_phone := regexp_replace(p_phone, '[\s\.\-\(\)]', '', 'g');

  -- Dedup per session
  IF p_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM walk_in_checkins
      WHERE phone = v_clean_phone AND session_id = p_session_id
    ) THEN
      SELECT
        COALESCE(at.label, 'buổi này') ||
        ' (' || to_char(ps.session_date, 'DD/MM') || ' ' ||
        to_char(ps.start_time, 'HH24:MI') || ')'
      INTO v_session_label
      FROM play_sessions ps
      LEFT JOIN activity_types at ON at.key = ps.activity_type
      WHERE ps.id = p_session_id;

      RAISE EXCEPTION 'Anh/chị đã check-in % rồi. Liên hệ host nếu cần hỗ trợ.', v_session_label;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM walk_in_checkins
      WHERE phone = v_clean_phone
        AND session_id IS NULL
        AND (checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    ) THEN
      RAISE EXCEPTION 'Anh/chị đã đăng ký hôm nay rồi. Liên hệ host nếu cần hỗ trợ.';
    END IF;
  END IF;

  SELECT id INTO v_existing_member_id FROM members
  WHERE phone = v_clean_phone AND is_active = true LIMIT 1;

  INSERT INTO walk_in_checkins (
    full_name, phone, session_id, referral_source,
    converted_to_member_id
  )
  VALUES (
    trim(p_full_name), v_clean_phone, p_session_id,
    NULLIF(trim(p_referral_source), ''), v_existing_member_id
  )
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'walk_in_id',         v_id,
    'is_existing_member', v_existing_member_id IS NOT NULL,
    'existing_member_id', v_existing_member_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.walk_in_checkin(text, text, text, uuid)
  TO anon, authenticated;

-- Update signup_member with new validation
DROP FUNCTION IF EXISTS public.signup_member(text, text, text, text, text);

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
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'Email không được để trống';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Số điện thoại là bắt buộc';
  END IF;

  IF NOT public.is_valid_vn_phone(p_phone) THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ — phải đủ 10 số bắt đầu bằng 0';
  END IF;

  v_clean_phone := regexp_replace(p_phone, '[\s\.\-\(\)]', '', 'g');

  IF p_experience NOT IN ('beginner', 'under_6m', 'over_6m') THEN
    RAISE EXCEPTION 'Kinh nghiệm không hợp lệ';
  END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính không hợp lệ';
  END IF;

  SELECT id INTO v_existing_id
  FROM members
  WHERE lower(email) = lower(p_email);

  IF v_existing_id IS NOT NULL THEN
    UPDATE members
    SET full_name = trim(p_full_name),
        phone = v_clean_phone,
        play_experience = p_experience,
        gender = COALESCE(p_gender, gender),
        is_active = true
    WHERE id = v_existing_id;
    v_member_id := v_existing_id;
  ELSE
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
      '2.0',
      true,
      v_signup_bonus
    )
    RETURNING id INTO v_member_id;
    v_is_new := true;
  END IF;

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
SELECT 'is_valid_vn_phone' AS check, prokind FROM pg_proc WHERE proname = 'is_valid_vn_phone';
SELECT public.is_valid_vn_phone('0901234567')  AS should_be_true;
SELECT public.is_valid_vn_phone('0123')        AS should_be_false_too_short;
SELECT public.is_valid_vn_phone('1234567890')  AS should_be_false_no_leading_0;
SELECT public.is_valid_vn_phone('0901 234 567') AS should_be_true_with_spaces;

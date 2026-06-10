-- ========================================
-- Walk-in UX fixes
-- 1. Admin notification: include session info (date + activity)
-- 2. Friendlier dedup error message (không lộ SĐT đầy đủ)
-- ========================================

-- 1. Update notify_admins_walkin: include session info
CREATE OR REPLACE FUNCTION public.notify_admins_walkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text;
  v_session_label text;
BEGIN
  v_body := NEW.full_name || ' · 📞 ' || NEW.phone;

  IF NEW.referral_source IS NOT NULL THEN
    v_body := v_body || ' · Biết qua: ' || NEW.referral_source;
  END IF;

  IF NEW.converted_to_member_id IS NOT NULL THEN
    v_body := v_body || ' · (đã là member)';
  END IF;

  -- Include session info if attached
  IF NEW.session_id IS NOT NULL THEN
    SELECT
      COALESCE(at.label, 'Buổi đánh') ||
      ' · ' || to_char(ps.session_date, 'DD/MM') ||
      ' ' || to_char(ps.start_time, 'HH24:MI')
    INTO v_session_label
    FROM play_sessions ps
    LEFT JOIN activity_types at ON at.key = ps.activity_type
    WHERE ps.id = NEW.session_id;

    IF v_session_label IS NOT NULL THEN
      v_body := v_body || ' · 📅 ' || v_session_label;
    END IF;
  END IF;

  INSERT INTO notifications (recipient_member_id, type, title, body, related_url)
  SELECT
    id,
    'walk_in',
    '🆕 Khách vãng lai',
    v_body,
    '/admin'
  FROM members
  WHERE (is_admin = true OR is_host = true) AND is_active = true;

  RETURN NEW;
END;
$$;

-- 2. Update walk_in_checkin: friendlier dedup messages
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
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập họ tên';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập số điện thoại';
  END IF;
  IF length(trim(p_phone)) < 9 OR length(trim(p_phone)) > 15 THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ (9-15 ký tự)';
  END IF;

  -- Dedup per session
  IF p_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM walk_in_checkins
      WHERE phone = trim(p_phone) AND session_id = p_session_id
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
    -- Dedup per day (when no session attached)
    IF EXISTS (
      SELECT 1 FROM walk_in_checkins
      WHERE phone = trim(p_phone)
        AND session_id IS NULL
        AND (checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    ) THEN
      RAISE EXCEPTION 'Anh/chị đã đăng ký hôm nay rồi. Liên hệ host nếu cần hỗ trợ.';
    END IF;
  END IF;

  -- Auto-detect if phone is a member
  SELECT id INTO v_existing_member_id FROM members
  WHERE phone = trim(p_phone) AND is_active = true LIMIT 1;

  INSERT INTO walk_in_checkins (
    full_name, phone, session_id, referral_source,
    converted_to_member_id
  )
  VALUES (
    trim(p_full_name), trim(p_phone), p_session_id,
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

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'walk_in_checkin updated' AS check, prosecdef
FROM pg_proc WHERE proname = 'walk_in_checkin';

SELECT 'notify_admins_walkin updated' AS check, prosecdef
FROM pg_proc WHERE proname = 'notify_admins_walkin';

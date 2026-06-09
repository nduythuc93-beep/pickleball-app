-- ========================================
-- Walk-in: cho phép check-in nhiều sessions/ngày (dedup theo session_id)
-- Cũ: 1 SĐT/ngày 1 lần (quá strict)
-- Mới: 1 SĐT/session 1 lần (1 ngày có thể check social + training + ball machine)
-- ========================================

-- Drop old constraint
DROP INDEX IF EXISTS uq_walkin_phone_date;

-- Mới: UNIQUE per session (1 phone không check-in cùng session 2 lần)
CREATE UNIQUE INDEX IF NOT EXISTS uq_walkin_phone_session
  ON walk_in_checkins(phone, session_id)
  WHERE session_id IS NOT NULL;

-- Cho walk-in KHÔNG có session_id (general lead): 1 SĐT/ngày 1 lần
CREATE UNIQUE INDEX IF NOT EXISTS uq_walkin_phone_date_no_session
  ON walk_in_checkins(phone, ((checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
  WHERE session_id IS NULL;

-- Update RPC: dedup theo session_id, hoặc theo ngày nếu không có session
CREATE OR REPLACE FUNCTION public.walk_in_checkin(
  p_full_name text, p_phone text,
  p_referral_source text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_existing_member_id uuid;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'SĐT không được để trống';
  END IF;

  -- Dedup theo session_id (nếu có)
  IF p_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM walk_in_checkins
      WHERE phone = trim(p_phone) AND session_id = p_session_id
    ) THEN
      RAISE EXCEPTION 'SĐT % đã check-in buổi này rồi', p_phone;
    END IF;
  ELSE
    -- Dedup theo ngày nếu không có session
    IF EXISTS (
      SELECT 1 FROM walk_in_checkins
      WHERE phone = trim(p_phone)
        AND session_id IS NULL
        AND (checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
            = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    ) THEN
      RAISE EXCEPTION 'SĐT % đã đăng ký hôm nay rồi', p_phone;
    END IF;
  END IF;

  -- Auto-detect nếu phone là member
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
    'walk_in_id', v_id,
    'is_existing_member', v_existing_member_id IS NOT NULL,
    'existing_member_id', v_existing_member_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.walk_in_checkin(text, text, text, uuid)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT indexname FROM pg_indexes
WHERE tablename = 'walk_in_checkins'
ORDER BY indexname;

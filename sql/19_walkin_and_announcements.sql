-- ========================================
-- Phase D + E: Walk-in QR checkin + Announcements
-- ========================================

-- ============ 1. WALK-IN CHECKINS ============
CREATE TABLE IF NOT EXISTS walk_in_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  session_id uuid REFERENCES play_sessions(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'qr_walkin',
  referral_source text,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  converted_to_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  notified_telegram_at timestamptz,
  notified_sheet_at timestamptz,
  notes text
);

-- Chống spam: 1 SĐT/ngày 1 lần (timezone VN để IMMUTABLE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_walkin_phone_date
  ON walk_in_checkins(phone, ((checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date));

CREATE INDEX IF NOT EXISTS idx_walkin_phone ON walk_in_checkins(phone);
CREATE INDEX IF NOT EXISTS idx_walkin_not_converted
  ON walk_in_checkins(phone) WHERE converted_to_member_id IS NULL;

-- RLS
ALTER TABLE walk_in_checkins ENABLE ROW LEVEL SECURITY;

-- Anon có thể INSERT (qua RPC)
-- Authenticated host/admin có thể SELECT + UPDATE
DROP POLICY IF EXISTS walkin_read_admin ON walk_in_checkins;
DROP POLICY IF EXISTS walkin_update_admin ON walk_in_checkins;
CREATE POLICY walkin_read_admin ON walk_in_checkins FOR SELECT TO authenticated
  USING (public.is_host_or_admin());
CREATE POLICY walkin_update_admin ON walk_in_checkins FOR UPDATE TO authenticated
  USING (public.is_host_or_admin()) WITH CHECK (public.is_host_or_admin());

-- ============ 2. RPC: walk_in_checkin ============
CREATE OR REPLACE FUNCTION public.walk_in_checkin(
  p_full_name text,
  p_phone text,
  p_referral_source text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing_count int;
  v_existing_member_id uuid;
BEGIN
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Họ tên không được để trống';
  END IF;
  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    RAISE EXCEPTION 'SĐT không được để trống';
  END IF;

  -- Check đã check-in cùng ngày (theo VN time)
  SELECT count(*) INTO v_existing_count
  FROM walk_in_checkins
  WHERE phone = trim(p_phone)
    AND (checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'SĐT % đã check-in hôm nay rồi', p_phone;
  END IF;

  -- Check SĐT có phải member chưa
  SELECT id INTO v_existing_member_id
  FROM members
  WHERE phone = trim(p_phone) AND is_active = true
  LIMIT 1;

  INSERT INTO walk_in_checkins (
    full_name, phone, session_id, referral_source,
    converted_to_member_id
  )
  VALUES (
    trim(p_full_name),
    trim(p_phone),
    p_session_id,
    NULLIF(trim(p_referral_source), ''),
    v_existing_member_id
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

-- ============ 3. Update signup_member để auto-link walk-in + bonus ============
DROP FUNCTION IF EXISTS public.signup_member(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.signup_member(
  p_full_name text,
  p_email text,
  p_phone text DEFAULT NULL,
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
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Giới tính không hợp lệ';
  END IF;

  SELECT id INTO v_existing_id
  FROM members
  WHERE lower(email) = lower(p_email);

  IF v_existing_id IS NOT NULL THEN
    UPDATE members
    SET full_name = trim(p_full_name),
        phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
        play_experience = p_experience,
        gender = COALESCE(p_gender, gender),
        is_active = true
    WHERE id = v_existing_id;
    v_member_id := v_existing_id;
  ELSE
    INSERT INTO members (
      full_name, email, phone, play_experience, gender,
      skill_level, is_active, total_points
    )
    VALUES (
      trim(p_full_name),
      lower(trim(p_email)),
      NULLIF(trim(p_phone), ''),
      p_experience,
      p_gender,
      'C',
      true,
      v_signup_bonus  -- BONUS 20đ cho member mới
    )
    RETURNING id INTO v_member_id;
    v_is_new := true;
  END IF;

  -- Auto-link walk-in records nếu SĐT giống
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    UPDATE walk_in_checkins
    SET converted_to_member_id = v_member_id
    WHERE phone = trim(p_phone)
      AND converted_to_member_id IS NULL;
    GET DIAGNOSTICS v_walkin_count = ROW_COUNT;
  END IF;

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

-- ============ 4. Reward "Chai nước miễn phí - Member mới" ============
INSERT INTO rewards (name, description, cost_points, stock, display_order, is_active)
VALUES (
  '🎁 Chai nước (Member mới)',
  'Quà chào mừng — 1 chai nước miễn phí cho thành viên mới đăng ký. Chỉ đổi được trong 7 ngày đầu.',
  0,
  NULL,
  0,
  true
)
ON CONFLICT DO NOTHING;

-- ============ 5. ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active
  ON announcements(is_active, is_pinned, created_at DESC)
  WHERE is_active = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_announcement_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_announcement_updated_at ON announcements;
CREATE TRIGGER trg_announcement_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_announcement_updated_at();

-- RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ann_read ON announcements;
DROP POLICY IF EXISTS ann_write ON announcements;
CREATE POLICY ann_read ON announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY ann_write ON announcements FOR ALL TO authenticated
  USING (public.is_host_or_admin())
  WITH CHECK (public.is_host_or_admin());

-- ============ 6. Notification webhook setup ============
-- Telegram + Google Sheet sẽ gọi qua pg_net khi có walk-in
-- Setup: anh chạy ALTER DATABASE để set config
-- ALTER DATABASE postgres SET app.telegram_bot_token = 'YOUR_BOT_TOKEN';
-- ALTER DATABASE postgres SET app.telegram_chat_id = 'YOUR_CHAT_ID';
-- ALTER DATABASE postgres SET app.sheet_webhook_url = 'YOUR_GOOGLE_APPS_SCRIPT_URL';

-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_walk_in_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telegram_token text;
  v_telegram_chat text;
  v_sheet_url text;
  v_text text;
  v_prev_count int;
BEGIN
  v_telegram_token := current_setting('app.telegram_bot_token', true);
  v_telegram_chat := current_setting('app.telegram_chat_id', true);
  v_sheet_url := current_setting('app.sheet_webhook_url', true);

  -- Count lần đến trước đó của SĐT này
  SELECT count(*) INTO v_prev_count
  FROM walk_in_checkins
  WHERE phone = NEW.phone AND id != NEW.id;

  v_text :=
    E'🆕 WALK-IN MỚI\n\n' ||
    '👤 ' || NEW.full_name || E'\n' ||
    '📞 ' || NEW.phone || E'\n' ||
    '🕐 ' || to_char(NEW.checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY') || E'\n';

  IF NEW.referral_source IS NOT NULL THEN
    v_text := v_text || '🔗 Biết qua: ' || NEW.referral_source || E'\n';
  END IF;

  IF v_prev_count > 0 THEN
    v_text := v_text || E'\n⭐ Khách quen — lần thứ ' || (v_prev_count + 1)::text;
  ELSE
    v_text := v_text || E'\n🌱 Khách MỚI lần đầu!';
  END IF;

  IF NEW.converted_to_member_id IS NOT NULL THEN
    v_text := v_text || E'\n✅ Đã là member';
  ELSE
    v_text := v_text || E'\n💡 Chưa member — cơ hội convert!';
  END IF;

  -- Send Telegram
  IF v_telegram_token IS NOT NULL AND v_telegram_chat IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://api.telegram.org/bot' || v_telegram_token || '/sendMessage',
      body := jsonb_build_object(
        'chat_id', v_telegram_chat,
        'text', v_text,
        'parse_mode', 'HTML'
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    UPDATE walk_in_checkins SET notified_telegram_at = now() WHERE id = NEW.id;
  END IF;

  -- Send Google Sheet
  IF v_sheet_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_sheet_url,
      body := jsonb_build_object(
        'name', NEW.full_name,
        'phone', NEW.phone,
        'time', to_char(NEW.checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY'),
        'referral', COALESCE(NEW.referral_source, ''),
        'is_member', NEW.converted_to_member_id IS NOT NULL,
        'previous_visits', v_prev_count
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    UPDATE walk_in_checkins SET notified_sheet_at = now() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Không fail transaction nếu notification lỗi
  RAISE NOTICE 'Notify walk-in error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_walk_in ON walk_in_checkins;
CREATE TRIGGER trg_notify_walk_in
  AFTER INSERT ON walk_in_checkins
  FOR EACH ROW EXECUTE FUNCTION public.notify_walk_in_checkin();

NOTIFY pgrst, 'reload schema';

-- ============ VERIFY ============
SELECT 'walk_in_checkins' AS table, count(*) FROM walk_in_checkins
UNION ALL SELECT 'announcements', count(*) FROM announcements
UNION ALL SELECT 'rewards (new gift)', count(*) FROM rewards WHERE name LIKE '%Chai nước (Member mới)%';

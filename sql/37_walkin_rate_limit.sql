-- ========================================
-- Walk-in rate limiting — chống abuse từ anonymous endpoint
-- ========================================
-- Threats:
-- - Bot spam phone giả → pollute DB + abuse Supabase free tier
-- - Phone enumeration → privacy issue (đoán SĐT member)
-- - Single IP DoS
--
-- Strategy:
-- - Per-IP limit: max 5 attempts (success + failed) per hour
-- - Per-phone limit: max 3 successful check-ins per hour
-- - Track tất cả attempts (success + blocked) cho future analytics
-- - Cron cleanup older than 24h

-- 1. Table track attempts
CREATE TABLE IF NOT EXISTS walk_in_rate_limits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address      text NOT NULL,
  phone           text,
  attempted_at    timestamptz NOT NULL DEFAULT now(),
  was_blocked     boolean NOT NULL DEFAULT false,
  block_reason    text
);

CREATE INDEX IF NOT EXISTS idx_walkin_rl_ip_time
  ON walk_in_rate_limits(ip_address, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_walkin_rl_phone_time
  ON walk_in_rate_limits(phone, attempted_at DESC)
  WHERE phone IS NOT NULL;

-- RLS: anon can insert (via RPC only), nothing else
ALTER TABLE walk_in_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rl_admin_read ON walk_in_rate_limits;
CREATE POLICY rl_admin_read ON walk_in_rate_limits
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No insert policy — only RPC can insert via SECURITY DEFINER

-- 2. Helper: extract client IP from request headers
CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers json;
  v_xff text;
BEGIN
  -- PostgREST sets request.headers from inbound request
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;

  IF v_headers IS NULL THEN
    RETURN 'unknown';
  END IF;

  -- Vercel / Cloudflare forwarded chain: take FIRST IP (real client)
  v_xff := v_headers->>'x-forwarded-for';
  IF v_xff IS NOT NULL THEN
    RETURN trim(split_part(v_xff, ',', 1));
  END IF;

  -- Fallback to direct connection
  RETURN COALESCE(v_headers->>'x-real-ip', 'unknown');
END;
$$;

-- 3. Update walk_in_checkin with rate limit
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
  v_ip text;
  v_ip_attempts int;
  v_phone_attempts int;
  v_block_reason text;
BEGIN
  -- Get client IP first — even for validation failures we'll log
  v_ip := public.get_client_ip();

  -- ============ RATE LIMIT CHECKS ============
  -- Per-IP: max 5 attempts (success + blocked) in last hour
  SELECT count(*) INTO v_ip_attempts
  FROM walk_in_rate_limits
  WHERE ip_address = v_ip
    AND attempted_at > now() - interval '1 hour';

  IF v_ip_attempts >= 5 THEN
    v_block_reason := 'ip_rate_limit';
    INSERT INTO walk_in_rate_limits (ip_address, phone, was_blocked, block_reason)
    VALUES (v_ip, NULLIF(trim(p_phone), ''), true, v_block_reason);

    RAISE EXCEPTION 'Có quá nhiều lượt check-in từ thiết bị này. Vui lòng thử lại sau 1 giờ hoặc liên hệ host tại sân.';
  END IF;

  -- ============ INPUT VALIDATION ============
  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    INSERT INTO walk_in_rate_limits (ip_address, was_blocked, block_reason)
    VALUES (v_ip, true, 'no_name');
    RAISE EXCEPTION 'Vui lòng nhập họ tên';
  END IF;

  IF p_phone IS NULL OR length(trim(p_phone)) = 0 THEN
    INSERT INTO walk_in_rate_limits (ip_address, was_blocked, block_reason)
    VALUES (v_ip, true, 'no_phone');
    RAISE EXCEPTION 'Vui lòng nhập số điện thoại';
  END IF;

  IF NOT public.is_valid_vn_phone(p_phone) THEN
    INSERT INTO walk_in_rate_limits (ip_address, phone, was_blocked, block_reason)
    VALUES (v_ip, trim(p_phone), true, 'invalid_phone');
    RAISE EXCEPTION 'Số điện thoại không hợp lệ — phải đủ 10 số bắt đầu bằng 0';
  END IF;

  v_clean_phone := regexp_replace(p_phone, '[\s\.\-\(\)]', '', 'g');

  -- Per-phone limit: max 3 SUCCESSFUL check-ins in last hour
  -- (allow some retries for genuine user but prevent automated abuse)
  SELECT count(*) INTO v_phone_attempts
  FROM walk_in_checkins
  WHERE phone = v_clean_phone
    AND checked_in_at > now() - interval '1 hour';

  IF v_phone_attempts >= 3 THEN
    INSERT INTO walk_in_rate_limits (ip_address, phone, was_blocked, block_reason)
    VALUES (v_ip, v_clean_phone, true, 'phone_rate_limit');
    RAISE EXCEPTION 'Số điện thoại này đã check-in quá nhiều buổi trong 1 giờ. Vui lòng thử lại sau.';
  END IF;

  -- ============ DEDUP ============
  IF p_session_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM walk_in_checkins
      WHERE phone = v_clean_phone AND session_id = p_session_id
    ) THEN
      INSERT INTO walk_in_rate_limits (ip_address, phone, was_blocked, block_reason)
      VALUES (v_ip, v_clean_phone, true, 'dedup_session');

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
      INSERT INTO walk_in_rate_limits (ip_address, phone, was_blocked, block_reason)
      VALUES (v_ip, v_clean_phone, true, 'dedup_day');
      RAISE EXCEPTION 'Anh/chị đã đăng ký hôm nay rồi. Liên hệ host nếu cần hỗ trợ.';
    END IF;
  END IF;

  -- ============ SUCCESS ============
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

  -- Log successful attempt for rate limit window
  INSERT INTO walk_in_rate_limits (ip_address, phone, was_blocked)
  VALUES (v_ip, v_clean_phone, false);

  RETURN json_build_object(
    'walk_in_id',         v_id,
    'is_existing_member', v_existing_member_id IS NOT NULL,
    'existing_member_id', v_existing_member_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.walk_in_checkin(text, text, text, uuid)
  TO anon, authenticated;

-- 4. Cleanup cron — remove rate limit rows older than 24h
CREATE OR REPLACE FUNCTION public.cleanup_walkin_rate_limits()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  WITH d AS (
    DELETE FROM walk_in_rate_limits
    WHERE attempted_at < now() - interval '24 hours'
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;

  RETURN json_build_object('deleted', v_deleted, 'cleaned_at', now());
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'cleanup-walkin-rate-limits';

    PERFORM cron.schedule(
      'cleanup-walkin-rate-limits',
      '15 * * * *',  -- mỗi giờ ở phút 15
      $cron$SELECT public.cleanup_walkin_rate_limits();$cron$
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'walk_in_rate_limits table' AS check, count(*) AS current_rows
FROM walk_in_rate_limits;
SELECT 'get_client_ip' AS check, prosecdef FROM pg_proc WHERE proname = 'get_client_ip';

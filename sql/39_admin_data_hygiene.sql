-- ========================================
-- Admin Data Hygiene tools
-- 1. get_db_stats() — overview của database
-- 2. cleanup_excess_data() — dọn data dư thừa / phân mảnh
-- 3. hard_delete_member(member_id) — xoá vĩnh viễn 1 member (bypass grace)
-- ========================================

-- 1. DB stats — admin overview
CREATE OR REPLACE FUNCTION public.get_db_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ admin được xem thống kê';
  END IF;

  RETURN json_build_object(
    -- Members
    'members_total',
      (SELECT count(*) FROM members),
    'members_active',
      (SELECT count(*) FROM members WHERE is_active = true),
    'members_inactive',
      (SELECT count(*) FROM members WHERE is_active = false AND deletion_requested_at IS NULL),
    'members_deletion_pending',
      (SELECT count(*) FROM members WHERE deletion_requested_at IS NOT NULL),
    'members_no_auth_link',
      (SELECT count(*) FROM members WHERE user_id IS NULL AND is_active = true),

    -- Sessions
    'sessions_total',
      (SELECT count(*) FROM play_sessions),
    'sessions_upcoming',
      (SELECT count(*) FROM play_sessions WHERE session_date >= current_date AND status != 'cancelled'),
    'sessions_past',
      (SELECT count(*) FROM play_sessions WHERE session_date < current_date),

    -- Check-ins
    'checkins_total',
      (SELECT count(*) FROM session_checkins),
    'checkins_warned',
      (SELECT count(*) FROM session_checkins WHERE is_warned = true),

    -- Walk-ins
    'walkins_total',
      (SELECT count(*) FROM walk_in_checkins),
    'walkins_orphan',
      (SELECT count(*) FROM walk_in_checkins
       WHERE session_id IS NULL
         AND converted_to_member_id IS NULL
         AND checked_in_at < now() - interval '7 days'),
    'walkins_converted',
      (SELECT count(*) FROM walk_in_checkins WHERE converted_to_member_id IS NOT NULL),

    -- Rewards
    'rewards_active',
      (SELECT count(*) FROM rewards WHERE is_active = true),
    'redemptions_pending',
      (SELECT count(*) FROM reward_redemptions WHERE status = 'pending'),
    'redemptions_cancelled_old',
      (SELECT count(*) FROM reward_redemptions
       WHERE status = 'cancelled' AND cancelled_at < now() - interval '90 days'),

    -- Tournaments
    'tournaments_active',
      (SELECT count(*) FROM tournaments WHERE status IN ('open', 'ongoing')),
    'registrations_withdrawn_old',
      (SELECT count(*) FROM tournament_registrations
       WHERE status = 'withdrawn' AND registered_at < now() - interval '90 days'),

    -- Surveys
    'surveys_open',
      (SELECT count(*) FROM surveys WHERE is_open = true),
    'survey_responses_total',
      (SELECT count(*) FROM survey_responses),

    -- Notifications
    'notifications_total',
      (SELECT count(*) FROM notifications),
    'notifications_unread',
      (SELECT count(*) FROM notifications WHERE is_read = false),
    'notifications_old_read',
      (SELECT count(*) FROM notifications
       WHERE is_read = true AND created_at < now() - interval '30 days'),

    -- Rate limits
    'rate_limits_total',
      (SELECT count(*) FROM walk_in_rate_limits),
    'rate_limits_expired',
      (SELECT count(*) FROM walk_in_rate_limits WHERE attempted_at < now() - interval '24 hours'),

    -- Opt-outs (past sessions)
    'opt_outs_past',
      (SELECT count(*) FROM session_host_opt_outs sho
       JOIN play_sessions ps ON ps.id = sho.session_id
       WHERE ps.session_date < current_date - interval '7 days'),

    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_db_stats() TO authenticated;

-- 2. Cleanup excess/fragmented data — admin manual sweep
CREATE OR REPLACE FUNCTION public.cleanup_excess_data()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notif int := 0;
  v_walkins int := 0;
  v_redemptions int := 0;
  v_registrations int := 0;
  v_rate_limits int := 0;
  v_opt_outs int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ admin được dọn dữ liệu';
  END IF;

  -- 2.1. Notifications: read + > 30 days, unread + > 90 days
  WITH d AS (
    DELETE FROM notifications
    WHERE (is_read = true AND created_at < now() - interval '30 days')
       OR (is_read = false AND created_at < now() - interval '90 days')
    RETURNING 1
  ) SELECT count(*) INTO v_notif FROM d;

  -- 2.2. Orphan walk-ins (no session, no member, > 7 days old)
  WITH d AS (
    DELETE FROM walk_in_checkins
    WHERE session_id IS NULL
      AND converted_to_member_id IS NULL
      AND checked_in_at < now() - interval '7 days'
    RETURNING 1
  ) SELECT count(*) INTO v_walkins FROM d;

  -- 2.3. Cancelled redemptions > 90 days
  WITH d AS (
    DELETE FROM reward_redemptions
    WHERE status = 'cancelled'
      AND cancelled_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO v_redemptions FROM d;

  -- 2.4. Withdrawn tournament registrations > 90 days
  WITH d AS (
    DELETE FROM tournament_registrations
    WHERE status = 'withdrawn'
      AND registered_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO v_registrations FROM d;

  -- 2.5. Rate limits > 24h
  WITH d AS (
    DELETE FROM walk_in_rate_limits
    WHERE attempted_at < now() - interval '24 hours'
    RETURNING 1
  ) SELECT count(*) INTO v_rate_limits FROM d;

  -- 2.6. Host opt-outs cho session đã > 7 ngày
  WITH d AS (
    DELETE FROM session_host_opt_outs sho
    USING play_sessions ps
    WHERE sho.session_id = ps.id
      AND ps.session_date < current_date - interval '7 days'
    RETURNING 1
  ) SELECT count(*) INTO v_opt_outs FROM d;

  RETURN json_build_object(
    'notifications_deleted',          v_notif,
    'orphan_walkins_deleted',         v_walkins,
    'cancelled_redemptions_deleted',  v_redemptions,
    'withdrawn_registrations_deleted',v_registrations,
    'expired_rate_limits_deleted',    v_rate_limits,
    'past_opt_outs_deleted',          v_opt_outs,
    'total_deleted',
      v_notif + v_walkins + v_redemptions + v_registrations + v_rate_limits + v_opt_outs,
    'cleaned_at',                     now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_excess_data() TO authenticated;

-- 3. Hard delete a specific member — admin only, bypass grace period
CREATE OR REPLACE FUNCTION public.hard_delete_member(p_member_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
  v_checkins int;
  v_walkins int;
  v_redemptions int;
  v_registrations int;
  v_notifications int;
  v_opt_outs int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ admin được xoá vĩnh viễn thành viên';
  END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy thành viên';
  END IF;

  -- Prevent admin deleting themselves
  IF v_member.user_id = auth.uid() THEN
    RAISE EXCEPTION 'Không được tự xoá tài khoản admin của mình';
  END IF;

  -- Count for return summary
  SELECT count(*) INTO v_checkins      FROM session_checkins        WHERE member_id = p_member_id;
  SELECT count(*) INTO v_walkins       FROM walk_in_checkins        WHERE converted_to_member_id = p_member_id;
  SELECT count(*) INTO v_redemptions   FROM reward_redemptions      WHERE member_id = p_member_id;
  SELECT count(*) INTO v_registrations FROM tournament_registrations WHERE member_id = p_member_id;
  SELECT count(*) INTO v_notifications FROM notifications           WHERE recipient_member_id = p_member_id;
  SELECT count(*) INTO v_opt_outs      FROM session_host_opt_outs   WHERE member_id = p_member_id;

  -- Walk-ins: just unlink (preserve historical record without PII linkage)
  UPDATE walk_in_checkins
  SET converted_to_member_id = NULL
  WHERE converted_to_member_id = p_member_id;

  -- DELETE member — cascades to checkins, redemptions, registrations,
  -- notifications, opt_outs via FK ON DELETE CASCADE
  DELETE FROM members WHERE id = p_member_id;

  -- Also delete auth.users if linked (so they can't login)
  IF v_member.user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_member.user_id;
  END IF;

  RETURN json_build_object(
    'success',                  true,
    'member_name',              v_member.full_name,
    'deleted_checkins',         v_checkins,
    'unlinked_walkins',         v_walkins,
    'deleted_redemptions',      v_redemptions,
    'deleted_registrations',    v_registrations,
    'deleted_notifications',    v_notifications,
    'deleted_opt_outs',         v_opt_outs,
    'auth_user_deleted',        v_member.user_id IS NOT NULL,
    'deleted_at',               now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hard_delete_member(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'get_db_stats' AS check, prosecdef FROM pg_proc WHERE proname = 'get_db_stats';
SELECT 'cleanup_excess_data' AS check, prosecdef FROM pg_proc WHERE proname = 'cleanup_excess_data';
SELECT 'hard_delete_member' AS check, prosecdef FROM pg_proc WHERE proname = 'hard_delete_member';

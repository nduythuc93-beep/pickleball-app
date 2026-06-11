-- ========================================
-- Sample verification queries — chạy trong Supabase SQL Editor
-- để verify state sau mỗi step trong e2e-checklist.md
-- ========================================

-- ============ SETUP VERIFICATION ============

-- Tất cả RPC mới đã có?
SELECT proname, prosecdef AS security_definer
FROM pg_proc
WHERE proname IN (
  'request_account_deletion',
  'cancel_deletion_request',
  'hard_delete_expired_accounts',
  'get_client_ip',
  'walk_in_checkin',
  'redeem_reward',
  'mark_redemption_delivered',
  'cancel_my_checkin',
  'mark_checkin_warned',
  'undo_checkin_warning',
  'get_home_data',
  'get_sessions_data',
  'is_valid_vn_phone',
  'cleanup_old_notifications',
  'cleanup_walkin_rate_limits'
)
ORDER BY proname;

-- Triggers active?
SELECT tgname, tgrelid::regclass AS on_table
FROM pg_trigger
WHERE tgname IN (
  'trg_update_member_points',
  'trg_notify_admins_redemption',
  'trg_notify_member_redemption_status',
  'trg_notify_admins_walkin',
  'trg_notify_admins_new_member',
  'trg_clear_opt_out_on_checkin'
)
ORDER BY tgname;

-- pg_cron jobs scheduled?
SELECT jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- Indexes mới có?
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN (
  'idx_walkin_session',
  'idx_walkin_rl_ip_time',
  'idx_walkin_rl_phone_time',
  'idx_opt_outs_member',
  'idx_members_deletion_pending'
)
ORDER BY tablename, indexname;

-- ============ FLOW VERIFICATION ============

-- 1. Walk-in count trong 24h
SELECT
  date_trunc('hour', checked_in_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS hour,
  count(*) AS checkins
FROM walk_in_checkins
WHERE checked_in_at > now() - interval '24 hours'
GROUP BY 1 ORDER BY 1 DESC;

-- 2. Member checkin với current points
SELECT
  m.full_name,
  m.total_points,
  count(sc.id) AS total_checkins,
  count(*) FILTER (WHERE sc.is_warned) AS warned_count
FROM members m
LEFT JOIN session_checkins sc ON sc.member_id = m.id
WHERE m.is_active = true
GROUP BY m.id, m.full_name, m.total_points
ORDER BY m.total_points DESC
LIMIT 10;

-- 3. Pending redemptions chờ admin xử lý
SELECT
  r.redeemed_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS redeemed_local,
  r.reward_name,
  r.cost_points,
  m.full_name AS member,
  m.phone
FROM reward_redemptions r
JOIN members m ON m.id = r.member_id
WHERE r.status = 'pending'
ORDER BY r.redeemed_at;

-- 4. Notifications của 1 admin/host gần đây
-- (Đổi 'YOUR_EMAIL' thành email admin để check)
SELECT
  n.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS sent_at,
  n.type,
  n.title,
  n.body,
  n.is_read
FROM notifications n
JOIN members m ON m.id = n.recipient_member_id
WHERE lower(m.email) = lower('YOUR_EMAIL')
ORDER BY n.created_at DESC
LIMIT 20;

-- ============ RATE LIMIT MONITORING ============

-- Pattern abuse trong 24h gần đây
SELECT
  ip_address,
  count(*) AS total_attempts,
  count(*) FILTER (WHERE was_blocked) AS blocked,
  array_agg(DISTINCT block_reason) FILTER (WHERE block_reason IS NOT NULL) AS reasons,
  max(attempted_at) AS last_attempt
FROM walk_in_rate_limits
WHERE attempted_at > now() - interval '24 hours'
GROUP BY ip_address
HAVING count(*) > 2
ORDER BY count(*) DESC
LIMIT 20;

-- Block reason distribution
SELECT
  block_reason,
  count(*)
FROM walk_in_rate_limits
WHERE was_blocked = true
  AND attempted_at > now() - interval '24 hours'
GROUP BY block_reason
ORDER BY count(*) DESC;

-- ============ ACCOUNT DELETION ============

-- Pending deletions (in 30-day grace)
SELECT
  id,
  full_name,
  email,
  deletion_requested_at,
  deletion_requested_at + interval '30 days' AS hard_delete_at,
  (deletion_requested_at + interval '30 days') - now() AS time_remaining
FROM members
WHERE deletion_requested_at IS NOT NULL
ORDER BY deletion_requested_at;

-- ============ POINTS BUG VERIFICATION ============
-- Sau khi check-in + cancel free + check-in lại, point phải +10 (không +20)

-- Tổng điểm tích luỹ vs tổng điểm từ checkins (nên gần bằng nhau,
-- chênh lệch là từ signup_bonus, warning penalty, redemption)
WITH stats AS (
  SELECT
    m.id,
    m.full_name,
    m.total_points,
    COALESCE(sum(sc.points_awarded), 0) AS earned_from_checkins,
    COALESCE(sum(sc.warned_penalty), 0) AS warning_penalty,
    COALESCE(sum(r.cost_points), 0) FILTER (WHERE r.status != 'cancelled') AS spent_on_rewards
  FROM members m
  LEFT JOIN session_checkins sc ON sc.member_id = m.id
  LEFT JOIN reward_redemptions r ON r.member_id = m.id
  WHERE m.is_active = true
  GROUP BY m.id, m.full_name, m.total_points
)
SELECT
  full_name,
  total_points AS current_points,
  earned_from_checkins,
  warning_penalty,
  spent_on_rewards,
  (earned_from_checkins - warning_penalty - spent_on_rewards) AS expected_min,
  CASE
    WHEN total_points < 0 THEN '🚨 ÂM — bug!'
    WHEN total_points > earned_from_checkins + 100 THEN '🚨 CAO BẤT THƯỜNG — kiểm tra farming!'
    ELSE '✓ OK'
  END AS status
FROM stats
ORDER BY total_points DESC
LIMIT 20;

-- ============ HOUSE-KEEPING ============

-- Notifications table size (cron mỗi 3am xoá > 30 ngày)
SELECT count(*) AS total, count(*) FILTER (WHERE is_read = false) AS unread
FROM notifications;

-- Walk-in rate limits size (cron mỗi giờ xoá > 24h)
SELECT count(*) AS total,
       count(*) FILTER (WHERE attempted_at > now() - interval '1 hour') AS last_hour
FROM walk_in_rate_limits;

-- Members soft-deleted vs total
SELECT
  count(*) AS total_members,
  count(*) FILTER (WHERE is_active) AS active,
  count(*) FILTER (WHERE deletion_requested_at IS NOT NULL) AS pending_hard_delete
FROM members;

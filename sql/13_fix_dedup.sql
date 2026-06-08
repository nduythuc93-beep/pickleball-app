-- ========================================
-- Fix: dedup session_schedules + play_sessions + thêm UNIQUE constraint
-- Nguyên nhân trùng: SQL seed có thể chạy nhiều lần, ON CONFLICT không có target
-- Nguyên nhân T2/T4/T6 sai: có thể do schedules duplicate gây nhiều INSERT cùng day
-- ========================================

-- ============ DIAGNOSTIC (xem trước khi fix) ============
-- 1. Check duplicate schedules
SELECT '⚠️ Trùng schedules:' AS check, activity_type, day_of_week, count(*) AS dup_count
FROM session_schedules
GROUP BY activity_type, day_of_week
HAVING count(*) > 1;

-- 2. Check duplicate play_sessions (same schedule_id + date)
SELECT '⚠️ Trùng sessions:' AS check, schedule_id, session_date, count(*) AS dup_count
FROM play_sessions
WHERE schedule_id IS NOT NULL
GROUP BY schedule_id, session_date
HAVING count(*) > 1;

-- 3. Xem hiện tại schedules thế nào (T2=1, T4=3, T6=5 đúng theo ISO)
SELECT activity_type, day_of_week,
  CASE day_of_week
    WHEN 1 THEN 'T2' WHEN 2 THEN 'T3' WHEN 3 THEN 'T4'
    WHEN 4 THEN 'T5' WHEN 5 THEN 'T6' WHEN 6 THEN 'T7' WHEN 7 THEN 'CN'
  END AS day_label,
  start_time, end_time, is_active
FROM session_schedules
ORDER BY day_of_week, activity_type;

-- ============ FIX 1: Dedup session_schedules ============
-- Giữ row cũ nhất (theo created_at) cho mỗi (activity_type, day_of_week)
WITH dup AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY activity_type, day_of_week
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM session_schedules
)
DELETE FROM session_schedules WHERE id IN (SELECT id FROM dup WHERE rn > 1);

-- Add UNIQUE constraint để chặn trùng từ giờ
ALTER TABLE session_schedules
  DROP CONSTRAINT IF EXISTS uq_schedules_activity_day;
ALTER TABLE session_schedules
  ADD CONSTRAINT uq_schedules_activity_day
  UNIQUE (activity_type, day_of_week);

-- ============ FIX 2: Dedup play_sessions ============
-- Giữ session cũ nhất cho mỗi (schedule_id, session_date)
-- Lưu ý: nếu session bị xoá, cascade xoá luôn checkins
WITH dup AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY schedule_id, session_date
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM play_sessions
  WHERE schedule_id IS NOT NULL
)
DELETE FROM play_sessions WHERE id IN (SELECT id FROM dup WHERE rn > 1);

-- Ensure UNIQUE index (partial vì manual sessions có schedule_id NULL)
DROP INDEX IF EXISTS uq_sessions_schedule_date;
CREATE UNIQUE INDEX uq_sessions_schedule_date
  ON play_sessions(schedule_id, session_date)
  WHERE schedule_id IS NOT NULL;

-- ============ FIX 3: Recompute total_points members (sau khi cascade xoá) ============
UPDATE members m
SET total_points = COALESCE((
  SELECT SUM(points_awarded) FROM session_checkins WHERE member_id = m.id
), 0);

-- ============ VERIFY ============
SELECT '✅ Sau fix:' AS check, count(*) AS total_schedules FROM session_schedules
UNION ALL
SELECT 'Total play_sessions:', count(*) FROM play_sessions
UNION ALL
SELECT 'Duplicate schedules còn:', count(*) FROM (
  SELECT activity_type, day_of_week FROM session_schedules
  GROUP BY 1, 2 HAVING count(*) > 1
) x
UNION ALL
SELECT 'Duplicate sessions còn:', count(*) FROM (
  SELECT schedule_id, session_date FROM play_sessions
  WHERE schedule_id IS NOT NULL
  GROUP BY 1, 2 HAVING count(*) > 1
) y;

-- Verify lịch định kỳ đúng T2/T4/T6
SELECT
  CASE day_of_week
    WHEN 1 THEN 'T2 ✓' WHEN 3 THEN 'T4 ✓' WHEN 5 THEN 'T6 ✓'
    ELSE 'Khác'
  END AS expected_day,
  activity_type, start_time, end_time
FROM session_schedules
WHERE is_active = true
ORDER BY day_of_week, activity_type;

NOTIFY pgrst, 'reload schema';

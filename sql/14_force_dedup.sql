-- ========================================
-- Force dedup mạnh hơn — dedup theo (activity_type, session_date, start_time)
-- Bất kể schedule_id (handle cả manual + duplicate cũ)
-- ========================================

-- ============ DIAGNOSTIC trước fix ============
SELECT '⚠️ Sessions tổng:' AS info, count(*) FROM play_sessions
UNION ALL
SELECT 'Duplicate (cùng type+date+time):', count(*) FROM (
  SELECT activity_type, session_date, start_time
  FROM play_sessions
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
) dup;

-- Xem các session cùng (type+date+time) trùng nhau
SELECT
  TO_CHAR(session_date, 'Dy DD/MM') AS date,
  activity_type,
  start_time,
  count(*) AS dup_count,
  array_agg(id::text) AS session_ids,
  array_agg(schedule_id::text) AS schedule_ids
FROM play_sessions
GROUP BY session_date, activity_type, start_time
HAVING count(*) > 1
ORDER BY session_date, activity_type;

-- ============ FIX: Dedup mạnh ============
-- Giữ session cũ nhất (created_at ASC). Cascade xoá checkins của duplicates.
-- Lưu ý: checkin của sessions bị xoá sẽ mất → recompute points cuối.
WITH dup AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY activity_type, session_date, start_time
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM play_sessions
)
DELETE FROM play_sessions WHERE id IN (SELECT id FROM dup WHERE rn > 1);

-- ============ THÊM UNIQUE CONSTRAINT mạnh ============
-- Chặn 2 session cùng activity_type + date + start_time
ALTER TABLE play_sessions
  DROP CONSTRAINT IF EXISTS uq_sessions_activity_date_time;
ALTER TABLE play_sessions
  ADD CONSTRAINT uq_sessions_activity_date_time
  UNIQUE (activity_type, session_date, start_time);

-- ============ XOÁ orphan sessions (day không match schedule) ============
-- WARNING: chỉ xoá sessions auto-generated với day_of_week không đúng schedule hiện tại
-- KHÔNG xoá manual sessions (schedule_id IS NULL — có thể là buổi đặc biệt anh tạo)
DELETE FROM play_sessions ps
WHERE ps.schedule_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM session_schedules s
    WHERE s.id = ps.schedule_id
      AND s.day_of_week = EXTRACT(ISODOW FROM ps.session_date)::int
  );

-- ============ Recompute total_points ============
UPDATE members m
SET total_points = COALESCE((
  SELECT SUM(points_awarded) FROM session_checkins WHERE member_id = m.id
), 0);

-- ============ VERIFY ============
SELECT '✅ Sau fix' AS section, '' AS detail
UNION ALL
SELECT 'Total sessions:', count(*)::text FROM play_sessions
UNION ALL
SELECT 'Duplicate còn:', count(*)::text FROM (
  SELECT activity_type, session_date, start_time
  FROM play_sessions
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
) x
UNION ALL
SELECT 'Sessions sai T2/T4/T6 (auto-gen):', count(*)::text
FROM play_sessions ps
WHERE ps.schedule_id IS NOT NULL
  AND EXTRACT(ISODOW FROM ps.session_date)::int NOT IN (1, 3, 5);

-- Xem sessions hiện tại theo ngày
SELECT
  session_date,
  TO_CHAR(session_date, 'Dy') AS day_short,
  EXTRACT(ISODOW FROM session_date)::int AS iso_dow,
  CASE EXTRACT(ISODOW FROM session_date)::int
    WHEN 1 THEN 'T2 ✓' WHEN 3 THEN 'T4 ✓' WHEN 5 THEN 'T6 ✓'
    ELSE '⚠️ Khác (manual?)'
  END AS expected,
  array_agg(activity_type ORDER BY start_time) AS activities
FROM play_sessions
WHERE session_date >= current_date - 7
  AND session_date <= current_date + 14
GROUP BY session_date
ORDER BY session_date;

NOTIFY pgrst, 'reload schema';

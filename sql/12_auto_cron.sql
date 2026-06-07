-- ========================================
-- Phase B partial: pg_cron auto-cleanup + auto-generate
-- - Mỗi 0h UTC (7h VN): xoá sessions > 14 ngày
-- - Mỗi 1h UTC (8h VN): auto-tạo sessions 7 ngày tới từ schedules
-- ========================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ========================================
-- FUNCTION 1: Cleanup old sessions
-- DELETE CASCADE sẽ xoá session_checkins luôn
-- ========================================
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  DELETE FROM play_sessions
  WHERE session_date < (current_date - interval '14 days')::date;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ========================================
-- FUNCTION 2: Auto-generate sessions cho N ngày tới (default 7)
-- Idempotent via NOT EXISTS check
-- ========================================
CREATE OR REPLACE FUNCTION public.auto_generate_sessions(p_days int DEFAULT 7)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_i int;
  v_date date;
  v_iso_dow int;
  v_inserted int;
BEGIN
  FOR v_i IN 0..p_days LOOP
    v_date := current_date + v_i;
    v_iso_dow := EXTRACT(ISODOW FROM v_date)::int;

    INSERT INTO play_sessions (
      activity_type, session_date, start_time, end_time, venue,
      max_attendees, price_vnd, points_award, instructor_name, schedule_id
    )
    SELECT
      s.activity_type, v_date, s.start_time, s.end_time, s.venue,
      s.max_attendees,
      COALESCE(s.price_vnd, at.default_price_vnd),
      COALESCE(s.points_award, at.default_points),
      s.instructor_name, s.id
    FROM session_schedules s
    JOIN activity_types at ON at.key = s.activity_type
    WHERE s.day_of_week = v_iso_dow
      AND s.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM play_sessions ps
        WHERE ps.schedule_id = s.id AND ps.session_date = v_date
      );

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_total := v_total + v_inserted;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ========================================
-- SCHEDULE: unschedule cũ + schedule mới
-- ========================================
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  FOR v_jobid IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('cleanup-old-sessions', 'auto-generate-sessions')
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Cleanup: mỗi ngày 0h UTC (7h sáng VN)
SELECT cron.schedule(
  'cleanup-old-sessions',
  '0 0 * * *',
  'SELECT public.cleanup_old_sessions()'
);

-- Auto-generate: mỗi ngày 1h UTC (8h sáng VN) — sau cleanup
SELECT cron.schedule(
  'auto-generate-sessions',
  '0 1 * * *',
  'SELECT public.auto_generate_sessions(7)'
);

-- Reload PostgREST
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname IN ('cleanup-old-sessions', 'auto-generate-sessions');

-- ========================================
-- Notification cleanup: tránh table phình to vô hạn
-- - Đã đọc + cũ hơn 30 ngày → xoá
-- - Chưa đọc + cũ hơn 90 ngày → xoá (treat as stale, user sẽ không đọc nữa)
-- ========================================

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_read_deleted int;
  v_unread_deleted int;
BEGIN
  -- Đã đọc + > 30 ngày
  WITH deleted AS (
    DELETE FROM notifications
    WHERE is_read = true
      AND created_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_read_deleted FROM deleted;

  -- Chưa đọc + > 90 ngày (stale)
  WITH deleted AS (
    DELETE FROM notifications
    WHERE is_read = false
      AND created_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_unread_deleted FROM deleted;

  RETURN json_build_object(
    'read_deleted',   v_read_deleted,
    'unread_deleted', v_unread_deleted,
    'cleaned_at',     now()
  );
END;
$$;

-- Schedule via pg_cron — chạy hàng ngày lúc 3am giờ VN (= 20:00 UTC hôm trước)
-- Nếu pg_cron chưa enable: enable trong Supabase Dashboard → Extensions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop existing schedule nếu có để rerun an toàn
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'cleanup-old-notifications';

    PERFORM cron.schedule(
      'cleanup-old-notifications',
      '0 20 * * *',  -- 20:00 UTC = 03:00 GMT+7
      $cron$SELECT public.cleanup_old_notifications();$cron$
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'cleanup-old-notifications';

-- Manual run (test/initial cleanup)
SELECT public.cleanup_old_notifications();

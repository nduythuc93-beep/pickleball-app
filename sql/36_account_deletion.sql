-- ========================================
-- Account Deletion — Compliant với Privacy Policy section 8 + Terms 9
-- Soft delete với 30-day grace period, sau đó hard delete via cron
-- ========================================

-- 1. Column track deletion request
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_members_deletion_pending
  ON members(deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

-- 2. request_account_deletion RPC
--    Soft delete: mark inactive, anonymize PII, schedule for hard delete in 30 days
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_email text;
  v_anonymized_email text;
  v_pending_redemptions int;
BEGIN
  SELECT id, email INTO v_member_id, v_email
  FROM members
  WHERE user_id = auth.uid() AND is_active = true;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy tài khoản hoặc đã được xoá';
  END IF;

  -- Cancel any pending redemptions (do NOT refund points — account being deleted)
  UPDATE reward_redemptions
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  WHERE member_id = v_member_id AND status = 'pending';
  GET DIAGNOSTICS v_pending_redemptions = ROW_COUNT;

  -- Anonymize PII immediately — soft delete
  -- Email gets a unique deleted marker so it can be reused for new signups
  v_anonymized_email := 'deleted-' || v_member_id || '@deleted.local';

  UPDATE members
  SET full_name             = 'Đã xoá tài khoản',
      email                 = v_anonymized_email,
      phone                 = NULL,
      avatar_url            = NULL,
      avatar_updated_at     = NULL,
      zalo_id               = NULL,
      bio                   = NULL,
      is_active             = false,
      is_admin              = false,
      is_host               = false,
      is_coach              = false,
      deletion_requested_at = now()
  WHERE id = v_member_id;

  RETURN json_build_object(
    'success',              true,
    'member_id',            v_member_id,
    'cancelled_redemptions', v_pending_redemptions,
    'grace_period_ends_at', now() + interval '30 days'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

-- 3. cancel_deletion_request RPC (within grace period — admin only since user is signed out)
CREATE OR REPLACE FUNCTION public.cancel_deletion_request(p_member_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member members%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Chỉ admin được khôi phục tài khoản trong grace period';
  END IF;

  SELECT * INTO v_member FROM members WHERE id = p_member_id;

  IF v_member.deletion_requested_at IS NULL THEN
    RAISE EXCEPTION 'Tài khoản chưa yêu cầu xoá';
  END IF;

  IF v_member.deletion_requested_at < now() - interval '30 days' THEN
    RAISE EXCEPTION 'Đã quá grace period 30 ngày, không thể khôi phục';
  END IF;

  -- Just reset the deletion request — admin should manually restore PII
  -- if member contacts them (we don't keep backup of PII, that's the point)
  UPDATE members
  SET deletion_requested_at = NULL,
      is_active = true
  WHERE id = p_member_id;

  RETURN json_build_object('success', true, 'note', 'Cần liên hệ member để khôi phục thông tin cá nhân');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_deletion_request(uuid) TO authenticated;

-- 4. Hard delete cron — runs after 30 days
CREATE OR REPLACE FUNCTION public.hard_delete_expired_accounts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids uuid[];
  v_member_count int := 0;
BEGIN
  -- Collect auth.users IDs to delete
  SELECT array_agg(user_id) INTO v_user_ids
  FROM members
  WHERE deletion_requested_at IS NOT NULL
    AND deletion_requested_at < now() - interval '30 days'
    AND user_id IS NOT NULL;

  -- Delete from auth.users (cascades to members via user_id FK if set)
  IF v_user_ids IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  END IF;

  -- Hard delete members rows (in case user_id was NULL)
  -- Their session_checkins, walk_in_checkins, etc. cascade-delete via FK
  WITH deleted AS (
    DELETE FROM members
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO v_member_count FROM deleted;

  RETURN json_build_object(
    'hard_deleted_count', v_member_count,
    'cleaned_at',         now()
  );
END;
$$;

-- Schedule via pg_cron — runs daily at 4am VN (= 21:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'hard-delete-expired-accounts';

    PERFORM cron.schedule(
      'hard-delete-expired-accounts',
      '0 21 * * *',
      $cron$SELECT public.hard_delete_expired_accounts();$cron$
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'request_account_deletion' AS check, prosecdef FROM pg_proc WHERE proname = 'request_account_deletion';
SELECT 'hard_delete_expired_accounts' AS check, prosecdef FROM pg_proc WHERE proname = 'hard_delete_expired_accounts';

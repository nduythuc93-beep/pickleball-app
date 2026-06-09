-- ========================================
-- Simplify: bỏ Telegram/Sheet → dùng in-app notifications
-- Notify admin + host khi có walk-in hoặc member mới
-- ========================================

-- 1. Bỏ trigger Telegram/Sheet cũ (không cần pg_net nữa)
DROP TRIGGER IF EXISTS trg_notify_walk_in ON walk_in_checkins;

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  related_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient_unread
  ON notifications(recipient_member_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notif_recipient_created
  ON notifications(recipient_member_id, created_at DESC);

-- 3. RLS — member chỉ thấy + update notification của mình
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_read_own ON notifications;
DROP POLICY IF EXISTS notif_update_own ON notifications;
CREATE POLICY notif_read_own ON notifications FOR SELECT TO authenticated
  USING (recipient_member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
CREATE POLICY notif_update_own ON notifications FOR UPDATE TO authenticated
  USING (recipient_member_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
  WITH CHECK (recipient_member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- 4. Trigger: walk-in mới → notify tất cả admin + host
CREATE OR REPLACE FUNCTION public.notify_admins_walkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text;
BEGIN
  v_body := NEW.full_name || ' · 📞 ' || NEW.phone;
  IF NEW.referral_source IS NOT NULL THEN
    v_body := v_body || ' · Biết qua: ' || NEW.referral_source;
  END IF;
  IF NEW.converted_to_member_id IS NOT NULL THEN
    v_body := v_body || ' · (đã là member)';
  END IF;

  INSERT INTO notifications (recipient_member_id, type, title, body, related_url)
  SELECT
    id,
    'walk_in',
    '🆕 Khách vãng lai',
    v_body,
    '/admin'
  FROM members
  WHERE (is_admin = true OR is_host = true) AND is_active = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_walkin ON walk_in_checkins;
CREATE TRIGGER trg_notify_admins_walkin
  AFTER INSERT ON walk_in_checkins
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_walkin();

-- 5. Trigger: member mới signup → notify admin + host
CREATE OR REPLACE FUNCTION public.notify_admins_new_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text;
BEGIN
  v_body := NEW.full_name;
  IF NEW.phone IS NOT NULL THEN
    v_body := v_body || ' · 📞 ' || NEW.phone;
  END IF;
  IF NEW.email IS NOT NULL THEN
    v_body := v_body || ' · ' || NEW.email;
  END IF;

  INSERT INTO notifications (recipient_member_id, type, title, body, related_url)
  SELECT
    id,
    'new_member',
    '🎉 Thành viên mới',
    v_body,
    '/members/' || NEW.id
  FROM members
  WHERE (is_admin = true OR is_host = true)
    AND is_active = true
    AND id != NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_member ON members;
CREATE TRIGGER trg_notify_admins_new_member
  AFTER INSERT ON members
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_member();

-- 6. RPC mark all read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_member_id uuid;
BEGIN
  SELECT id INTO v_member_id FROM members WHERE user_id = auth.uid() LIMIT 1;
  IF v_member_id IS NULL THEN RETURN 0; END IF;

  UPDATE notifications SET is_read = true
  WHERE recipient_member_id = v_member_id AND is_read = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'notifications' AS info, count(*) FROM notifications;
SELECT 'admins+hosts count' AS info, count(*) FROM members WHERE (is_admin OR is_host) AND is_active;

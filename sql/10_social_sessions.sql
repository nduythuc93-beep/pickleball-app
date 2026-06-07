-- ========================================
-- Phase A: Social Play Sessions
-- 3 activity types (social/training/ball_machine)
-- Recurring schedules T2/T4/T6 sáng 7-10h
-- Check-in earn points, host/admin có thể mark paid
-- ========================================

-- 1. Activity types (lookup)
CREATE TABLE IF NOT EXISTS activity_types (
  key text PRIMARY KEY,
  label text NOT NULL,
  default_price_vnd int NOT NULL DEFAULT 0,
  default_points int NOT NULL DEFAULT 0,
  color text,
  icon text,
  requires_instructor boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0
);

INSERT INTO activity_types (key, label, default_price_vnd, default_points, color, icon, requires_instructor, display_order)
VALUES
  ('social',       'Đánh Social',    60000,  10, 'emerald', '🏓', false, 1),
  ('training',     'Training HLV',  150000,   0, 'amber',   '🎯', true,  2),
  ('ball_machine', 'Máy bắn bóng',  150000,   5, 'blue',    '⚡', false, 3)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  default_price_vnd = EXCLUDED.default_price_vnd,
  default_points = EXCLUDED.default_points,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  requires_instructor = EXCLUDED.requires_instructor,
  display_order = EXCLUDED.display_order;

-- 2. Recurring schedule template
CREATE TABLE IF NOT EXISTS session_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL REFERENCES activity_types(key) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- ISO: 1=Mon, 7=Sun
  start_time time NOT NULL,
  end_time time NOT NULL,
  venue text NOT NULL DEFAULT 'Sân chung',
  max_attendees int NOT NULL DEFAULT 12,
  price_vnd int,           -- nullable = dùng default từ activity_type
  points_award int,        -- nullable = dùng default
  instructor_name text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_active ON session_schedules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schedules_dow ON session_schedules(day_of_week);

-- 3. Actual play sessions (created từ schedules hoặc manual)
CREATE TABLE IF NOT EXISTS play_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type text NOT NULL REFERENCES activity_types(key) ON DELETE RESTRICT,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  venue text NOT NULL,
  max_attendees int NOT NULL DEFAULT 12,
  price_vnd int NOT NULL,
  points_award int NOT NULL DEFAULT 0,
  instructor_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ongoing','completed','cancelled')),
  notes text,
  schedule_id uuid REFERENCES session_schedules(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON play_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON play_sessions(activity_type);
-- Tránh duplicate auto-create (1 schedule chỉ tạo 1 session/ngày)
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_schedule_date
  ON play_sessions(schedule_id, session_date)
  WHERE schedule_id IS NOT NULL;

-- 4. Check-ins
CREATE TABLE IF NOT EXISTS session_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES play_sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  points_awarded int NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  paid_marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(session_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_checkins_session ON session_checkins(session_id);
CREATE INDEX IF NOT EXISTS idx_checkins_member ON session_checkins(member_id);

-- 5. Members thêm total_points
ALTER TABLE members ADD COLUMN IF NOT EXISTS total_points int NOT NULL DEFAULT 0;

-- 6. Trigger auto-update total_points khi checkin
CREATE OR REPLACE FUNCTION public.update_member_points_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE members SET total_points = total_points + COALESCE(NEW.points_awarded, 0)
    WHERE id = NEW.member_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.points_awarded IS DISTINCT FROM OLD.points_awarded THEN
    UPDATE members SET total_points = total_points + (COALESCE(NEW.points_awarded, 0) - COALESCE(OLD.points_awarded, 0))
    WHERE id = NEW.member_id;
  END IF;
  -- DELETE: KHÔNG trừ điểm (lifetime achievement, cleanup không reset)
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_member_points ON session_checkins;
CREATE TRIGGER trg_update_member_points
  AFTER INSERT OR UPDATE ON session_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_member_points_on_checkin();

-- 7. Helper function: check là host hoặc admin
CREATE OR REPLACE FUNCTION public.is_host_or_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
      AND (is_admin = true OR is_host = true)
      AND is_active = true
  );
$$;

-- 8. RLS
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_checkins ENABLE ROW LEVEL SECURITY;

-- activity_types: everyone read, admin only write
DROP POLICY IF EXISTS at_read ON activity_types;
DROP POLICY IF EXISTS at_admin_write ON activity_types;
CREATE POLICY at_read ON activity_types FOR SELECT TO authenticated USING (true);
CREATE POLICY at_admin_write ON activity_types FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- session_schedules: everyone read, admin only write
DROP POLICY IF EXISTS sch_read ON session_schedules;
DROP POLICY IF EXISTS sch_admin_write ON session_schedules;
CREATE POLICY sch_read ON session_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY sch_admin_write ON session_schedules FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- play_sessions: everyone read, admin insert/delete, host+admin update
DROP POLICY IF EXISTS ps_read ON play_sessions;
DROP POLICY IF EXISTS ps_admin_insert ON play_sessions;
DROP POLICY IF EXISTS ps_admin_delete ON play_sessions;
DROP POLICY IF EXISTS ps_host_update ON play_sessions;
CREATE POLICY ps_read ON play_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY ps_admin_insert ON play_sessions FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY ps_host_update ON play_sessions FOR UPDATE TO authenticated
  USING (public.is_host_or_admin()) WITH CHECK (public.is_host_or_admin());
CREATE POLICY ps_admin_delete ON play_sessions FOR DELETE TO authenticated USING (public.is_admin());

-- session_checkins
DROP POLICY IF EXISTS ci_read ON session_checkins;
DROP POLICY IF EXISTS ci_insert_own ON session_checkins;
DROP POLICY IF EXISTS ci_insert_host ON session_checkins;
DROP POLICY IF EXISTS ci_update_host ON session_checkins;
DROP POLICY IF EXISTS ci_delete ON session_checkins;
CREATE POLICY ci_read ON session_checkins FOR SELECT TO authenticated USING (true);
CREATE POLICY ci_insert_own ON session_checkins FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.is_host_or_admin()
  );
CREATE POLICY ci_update_host ON session_checkins FOR UPDATE TO authenticated
  USING (public.is_host_or_admin()) WITH CHECK (public.is_host_or_admin());
CREATE POLICY ci_delete ON session_checkins FOR DELETE TO authenticated
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR public.is_host_or_admin()
  );

-- 9. Seed lịch T2/T4/T6 với 3 hoạt động
INSERT INTO session_schedules (activity_type, day_of_week, start_time, end_time, venue, max_attendees)
VALUES
  -- T2 (Monday = 1)
  ('social',       1, '07:00', '10:00', 'Sân chung', 16),
  ('training',     1, '07:00', '09:00', 'Sân chung',  8),
  ('ball_machine', 1, '07:00', '09:00', 'Sân chung',  6),
  -- T4 (Wednesday = 3)
  ('social',       3, '07:00', '10:00', 'Sân chung', 16),
  ('training',     3, '07:00', '09:00', 'Sân chung',  8),
  ('ball_machine', 3, '07:00', '09:00', 'Sân chung',  6),
  -- T6 (Friday = 5)
  ('social',       5, '07:00', '10:00', 'Sân chung', 16),
  ('training',     5, '07:00', '09:00', 'Sân chung',  8),
  ('ball_machine', 5, '07:00', '09:00', 'Sân chung',  6)
ON CONFLICT DO NOTHING;

-- 10. Recompute total_points cho member hiện có (idempotent)
UPDATE members m
SET total_points = COALESCE((
  SELECT SUM(points_awarded) FROM session_checkins WHERE member_id = m.id
), 0);

-- 11. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 'activity_types' AS table, count(*) FROM activity_types
UNION ALL SELECT 'session_schedules', count(*) FROM session_schedules
UNION ALL SELECT 'play_sessions', count(*) FROM play_sessions
UNION ALL SELECT 'session_checkins', count(*) FROM session_checkins;
-- Expect: activity_types=3, session_schedules=9, play_sessions=0, session_checkins=0

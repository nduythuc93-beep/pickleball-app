-- ========================================
-- Phase 2: Add Coach + Host roles
-- ========================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_coach boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_host  boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_members_coach ON members(is_coach) WHERE is_coach = true;
CREATE INDEX IF NOT EXISTS idx_members_host  ON members(is_host)  WHERE is_host  = true;

-- Demo: gán 1 người làm Coach, 1 người làm Host để test UI
UPDATE members SET is_coach = true WHERE phone = '0901111111'; -- Nguyễn Văn An (A) → Coach
UPDATE members SET is_host  = true WHERE phone = '0907777777'; -- Đặng Văn Giang (A) → Host
UPDATE members SET is_coach = true, is_host = true WHERE phone = '0903333333'; -- Lê Minh Cường → cả 2

SELECT full_name, skill_level, is_admin, is_coach, is_host
FROM members
ORDER BY is_admin DESC, is_coach DESC, is_host DESC, full_name;

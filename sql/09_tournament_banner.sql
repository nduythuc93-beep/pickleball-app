-- ========================================
-- Phase 4.1: Tournament banner image
-- Banner ảnh để phân biệt các giải khác nhau
-- ========================================

-- 1. Add banner columns
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS banner_updated_at timestamptz;

-- 2. Reuse 'avatars' bucket với path 'tournaments/{id}/{ts}.webp'
-- Storage policies hiện có:
--   - avatars_read: ai cũng SELECT được
--   - avatars_admin_all: admin TOÀN QUYỀN trên bucket avatars
-- → admin upload tournament banner sẽ work mà không cần policy mới

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tournaments'
  AND column_name LIKE 'banner%';
-- Phải show 2 dòng: banner_url, banner_updated_at

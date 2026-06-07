-- ========================================
-- Pickleball App — Seed data (test)
-- Chạy SAU 01, 02, 03 — và sau khi anh đã đăng nhập lần đầu vào app
-- ========================================

-- ⚠️ TRƯỚC KHI CHẠY:
-- 1. Mở app, login bằng magic link với email của anh
-- 2. Sau khi nhận magic link và click, anh sẽ có 1 record trong auth.users
-- 3. Chạy query này để lấy user_id:
--      SELECT id, email FROM auth.users;
-- 4. Copy uuid của anh vào dòng dưới (thay <YOUR_USER_ID>)

-- Tạo admin member cho chính anh
INSERT INTO members (full_name, email, phone, skill_level, is_admin, user_id, zalo_id)
VALUES
  ('Duy Thúc', 'nduythuc93@gmail.com', '0900000000', 'B+', true, NULL, 'duythuc');
-- Sau khi insert, UPDATE user_id = uuid từ auth.users
-- UPDATE members SET user_id = '<YOUR_USER_ID>' WHERE email = 'nduythuc93@gmail.com';

-- ========================================
-- Seed 9 thành viên test (không cần user_id, chưa login)
-- ========================================
INSERT INTO members (full_name, phone, skill_level, zalo_id, bio) VALUES
  ('Nguyễn Văn An',     '0901111111', 'A',  'an_pickle',   'Cựu VĐV tennis chuyển sang pickleball'),
  ('Trần Thị Bình',     '0902222222', 'B+', 'binh_tran',   'Đi đánh tối thứ 3 và CN'),
  ('Lê Minh Cường',     '0903333333', 'B+', 'cuong_le',    'Backhand mạnh'),
  ('Phạm Thị Dung',     '0904444444', 'B-', 'dung_pham',   'Mới chơi 6 tháng, đang tiến bộ'),
  ('Hoàng Văn Em',      '0905555555', 'B-', 'em_hoang',    'Thích chơi đôi nam'),
  ('Vũ Thị Phương',     '0906666666', 'C',  'phuong_vu',   'Mới tập, cần partner kèm'),
  ('Đặng Văn Giang',    '0907777777', 'A',  'giang_dang',  'Smash chuẩn'),
  ('Bùi Thị Hằng',      '0908888888', 'B+', 'hang_bui',    'Drop shot tốt'),
  ('Ngô Văn Inh',       '0909999999', 'C',  'inh_ngo',     'Vừa join CLB tuần trước');

-- ========================================
-- Seed 1 survey test (jersey)
-- ========================================
INSERT INTO surveys (title, description, type, fields_schema, closes_at, is_open) VALUES
(
  'Đặt áo CLB tháng 6',
  'Đặt áo đồng phục CLB pickleball — màu xanh primary, in logo trước ngực',
  'jersey',
  '[
    {"key":"size","label":"Size áo","type":"single_select","options":["S","M","L","XL","XXL"],"required":true},
    {"key":"quantity","label":"Số lượng","type":"number","default":1,"min":1,"max":5,"required":true},
    {"key":"name_on_jersey","label":"Tên in áo (in lưng)","type":"text","required":true},
    {"key":"notes","label":"Ghi chú","type":"textarea"}
  ]'::jsonb,
  (now() + interval '14 days'),
  true
);

-- ========================================
-- Seed 1 tournament test
-- ========================================
INSERT INTO tournaments (name, description, format, skill_filter, event_date, venue, max_teams, status) VALUES
(
  'Giải nội bộ CLB tháng 7',
  'Round robin hạng B+ trở xuống — vui là chính, có giải thưởng nhỏ',
  'round_robin',
  ARRAY['B+','B-','C'],
  (CURRENT_DATE + interval '30 days')::date,
  'Sân Pickleball Quận 7',
  8,
  'open'
);

-- ========================================
-- Check seed
-- ========================================
-- SELECT COUNT(*) FROM members;          -- expect 10
-- SELECT COUNT(*) FROM surveys;          -- expect 1
-- SELECT COUNT(*) FROM tournaments;      -- expect 1

# TASKS.md — Pickleball App Build Plan (v2)

## PHASE 1 — Foundation
> Mục tiêu: chạy được app trên mobile, login được, xem được danh sách thành viên

- [ ] **P1-01** Khởi tạo project: `npm create vite@latest pickleball-app -- --template react-ts`
- [ ] **P1-02** Cài dependencies:
  ```bash
  # Core
  npm i @supabase/supabase-js react-router-dom react-hot-toast lucide-react
  # Forms + validation
  npm i react-hook-form zod @hookform/resolvers
  # Utils
  npm i date-fns clsx tailwind-merge
  # Tailwind
  npm i -D tailwindcss@^3 postcss autoprefixer
  npx tailwindcss init -p
  ```
- [ ] **P1-03** Setup Supabase project + lấy URL và anon key, tạo `.env.local`
- [ ] **P1-04** Chạy SQL tạo toàn bộ tables trong Supabase SQL editor (theo schema trong CLAUDE.md — nhớ chạy cả phần CREATE INDEX)
- [ ] **P1-05** Enable Supabase Storage, tạo bucket `avatars` (public read OFF — dùng signed URL hoặc bucket policy)
- [ ] **P1-06a** Chạy SQL tạo helper function `is_admin()` (xem CLAUDE.md → RLS section)
- [ ] **P1-06b** RLS policies cho `members` (3 policies: select_all, update_own, admin_all)
- [ ] **P1-06c** RLS policies cho `surveys` + `survey_responses` (5 policies tổng)
- [ ] **P1-06d** RLS policies cho `tournaments` + `tournament_registrations` + `tournament_matches` (7 policies tổng)
- [ ] **P1-06e** Storage policies cho bucket `avatars` (3 policies)
- [ ] **P1-07** Tạo `src/lib/supabase.ts` — khởi tạo client với type generics
- [ ] **P1-08** Tạo Layout component: TopBar + BottomNav (4 tab, hide Admin tab nếu không phải admin)
- [ ] **P1-09** Setup React Router với routes: `/login`, `/members`, `/members/:id`, `/surveys`, `/surveys/:id`, `/tournaments`, `/tournaments/:id`, `/admin`
- [ ] **P1-10** Tạo LoginPage: **magic link email only** (bỏ OTP phone)
- [ ] **P1-11** Auth context + `useAuth` hook:
  - Lưu `session`, `user`, `member` (joined từ members table), `isAdmin`
  - Khi login thành công lần đầu: query `members.email = user.email`, nếu match → update `members.user_id = user.id`
  - Nếu không match → redirect `/no-access` với message liên hệ admin
- [ ] **P1-12** MembersPage: fetch + hiển thị danh sách (tên + skill badge), filter `is_active = true`
- [ ] **P1-13** SkillBadge component: A=green, B+=blue, B-=amber, C=gray
- [ ] **P1-14** Seed data via SQL editor: insert 5-10 member mẫu (1 trong đó `is_admin = true` để test)

---

## PHASE 2 — Members đầy đủ
> Mục tiêu: profile page + avatar upload hoạt động

- [ ] **P2-01** MemberAvatar component: hiển thị ảnh (lazy load) hoặc initials circle với màu hash từ tên
- [ ] **P2-02** MemberDetailPage: avatar lớn + full info + lịch sử giải tham gia
- [ ] **P2-03** Avatar upload flow (`src/lib/storage.ts`):
  - Validate: jpg/png/webp, max 5MB → error toast nếu fail
  - Input file → canvas resize 400x400 → `canvas.toBlob('image/webp', 0.85)`
  - Path: `avatars/{member_id}/{Date.now()}.webp`
  - **List + delete file cũ trong folder** trước khi upload mới (tránh garbage)
  - Update `members.avatar_url` + `members.avatar_updated_at`
- [ ] **P2-04** Search thành viên theo tên (client-side filter, debounce 200ms)
- [ ] **P2-05** Filter theo skill level (A / B+ / B- / C / Tất cả) — segmented control
- [ ] **P2-06** AdminPage — Members tab: form thêm/sửa thành viên (react-hook-form + Zod)
- [ ] **P2-07** Cập nhật skill: log `skill_updated_by` + `skill_updated_at`, chỉ admin (RLS đã enforce)
- [ ] **P2-08** Toggle `is_active` (soft delete): tab "Inactive" trong admin

---

## PHASE 3 — Surveys
> Mục tiêu: admin tạo khảo sát, thành viên điền, admin xem kết quả

- [ ] **P3-01** SurveysPage: list khảo sát đang mở + đã đóng (tab/section riêng)
- [ ] **P3-02** SurveyCard: tiêu đề + deadline + tiến độ (X/Y đã điền)
- [ ] **P3-03** SurveyDetailPage: render form động từ `fields_schema`
- [ ] **P3-04** `src/lib/schema.ts`: function `fieldSchemaToZod(fields: FieldSchema[]): ZodSchema` — generate Zod schema runtime để validate
- [ ] **P3-05** FieldRenderer component hỗ trợ types:
  - `single_select` → pill buttons (selected state với primary color)
  - `number` → +/- stepper, respect min/max
  - `text` → input
  - `textarea` → textarea (4 rows)
  - `yes_no` → 2 button Có/Không
  - Hiển thị label + required indicator (*) + error message
- [ ] **P3-06** Submit response → validate Zod → insert `survey_responses` → disable form + show "Đã gửi" nếu đã điền
- [ ] **P3-07** AdminPage — Surveys tab:
  - Tạo survey từ 3 template (jersey / tournament / attendance) — clone `fields_schema` từ template
  - Chỉnh title, description, closes_at
  - Toggle `is_open` thủ công
  - Edit `fields_schema` cho custom survey (JSON editor đơn giản)
- [ ] **P3-08** Admin xem kết quả:
  - Tổng hợp: với `single_select`/`yes_no` → count per option
  - `number` → sum, avg, min, max
  - `text`/`textarea` → list values
  - Danh sách full responses theo từng member
- [ ] **P3-09** Export CSV (`src/lib/csv.ts`): `Blob` + `URL.createObjectURL` + auto-download

---

## PHASE 4 — Tournaments
> Mục tiêu: tạo giải, đăng ký, nhập kết quả, xem bracket

- [ ] **P4-01** TournamentsPage: list giải (filter theo status: draft / open / ongoing / completed)
- [ ] **P4-02** TournamentDetailPage: info header + tab Đăng ký / Bracket / Kết quả
- [ ] **P4-03** RegistrationForm: chọn category + autocomplete partner (search trong members) → submit
- [ ] **P4-04** AdminPage — Tournaments tab: form tạo giải (đầy đủ fields, skill_filter là multi-select)
- [ ] **P4-05** Admin confirm đăng ký:
  - Bấm confirm 1 registration → set `status='confirmed'`
  - Nếu có `partner_id` và chưa có mirror registration → auto-tạo mirror cho partner (`is_mirror=true`, `member_id=partner_id`, `partner_id=originalMember`, `status='confirmed'`)
  - Khi withdraw → cascade delete cả 2
- [ ] **P4-06a** `src/lib/bracket.ts`:
  - `generateRoundRobin(teams: Team[]): Match[]` — combinatorics đôi một
  - `generateSingleElim(teams: Team[]): Match[]` — handle bye nếu count không phải lũy thừa của 2
  - Pure functions, unit test được (xem P5-04)
- [ ] **P4-06b** RoundRobinTable component: render matrix N×N với scores
- [ ] **P4-07** SingleElimBracket component: tree view, highlight winner path
- [ ] **P4-08** MatchCard + nhập kết quả: admin bấm match → modal nhập score → save → auto-set `winner_ids` (team có score cao hơn)
- [ ] **P4-09** Bảng xếp hạng:
  - Round robin: tính W/L/points (set diff) → sort
  - Elimination: hiển thị vòng đi tới của mỗi team
- [ ] **P4-10** Khi tất cả match Final đã có winner → admin bấm "Kết thúc giải" → set `tournaments.status='completed'` + `tournaments.winner_ids = final.winner_ids`

---

## PHASE 5 — Polish & Deploy
- [ ] **P5-01** Global error boundary + Supabase error → toast (không crash app)
- [ ] **P5-02** Loading skeletons cho list pages (members, surveys, tournaments)
- [ ] **P5-03** Empty states (chưa có thành viên, chưa có giải, chưa có khảo sát...)
- [ ] **P5-04** Unit tests cho `lib/bracket.ts` (Vitest) — test round robin + single elim với 3/4/5/8 teams
- [ ] **P5-05** PWA setup: `vite-plugin-pwa` + manifest.json + service worker (cache static assets only, không cache Supabase data)
- [ ] **P5-06** Toast notifications đầy đủ (thành công / lỗi / warning)
- [ ] **P5-07** Deploy lên Vercel + set environment variables
- [ ] **P5-08** Test toàn bộ flow trên mobile thật (iOS Safari + Android Chrome)
- [ ] **P5-09** Tạo 1 admin account (SQL set `is_admin=true` thủ công), invite thành viên đầu tiên

---

## Thứ tự ưu tiên nếu muốn dùng sớm
**Phase 1 → Phase 2 → Phase 3 (P3-01 → P3-06) → P5-07 deploy tạm**
Sau đó bổ sung Phase 4 khi gần có giải đấu.

---

## Notes kỹ thuật
- State management: `useState` + `useEffect` + Supabase trực tiếp (không cần React Query / Zustand cho scale này)
- Tournament bracket logic: tách `src/lib/bracket.ts` riêng (pure functions, testable)
- Avatar resize: `canvas.toBlob('image/webp', 0.85)` — không cần thư viện
- CSV export: `new Blob([csv], {type:'text/csv;charset=utf-8'})` + `URL.createObjectURL` + auto-click link
- FieldSchema → Zod: dùng `z.object()` build dynamic theo type, return ZodSchema
- Magic link redirect URL phải add vào Supabase Dashboard → Authentication → URL Configuration

## Các quyết định kỹ thuật đã chốt (vs spec v1)
1. **Auth**: magic link email only, không OTP phone
2. **Admin role**: cột `members.is_admin` (không tạo bảng riêng `admin_users`)
3. **Auth ↔ Member link**: cột `members.user_id` references `auth.users(id)`, auto-link khi login lần đầu qua email match
4. **Skill levels**: giữ A/B+/B-/C (convention cộng đồng VN, không thêm B)
5. **Doubles registration**: 1 record + auto-mirror khi admin confirm
6. **Avatar storage path**: `avatars/{member_id}/{timestamp}.webp` (folder per member, cache bust qua timestamp)
7. **Notifications MVP**: out of scope, post Zalo group thủ công

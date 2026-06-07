# Pickleball Community App — Master Spec (v2)

## Project overview
Web app quản lý cộng đồng pickleball nội bộ (~100 thành viên).
Mobile-first, PWA-ready. Dùng nội bộ, không public.

## Tech stack
- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS v3
- **Backend/DB**: Supabase (Auth + PostgreSQL + Storage)
- **Deploy**: Vercel
- **Avatar upload**: Supabase Storage bucket `avatars`

## Core color
Primary green: `#1D9E75` (pickleball brand color dùng xuyên suốt)

## Skill levels
Hệ thống 4 mức: **A / B+ / B- / C** (theo convention cộng đồng pickleball VN — không có B thường, đây là intentional).

---

## Database schema (Supabase)

### `members`
```sql
id                 uuid PK default gen_random_uuid()
user_id            uuid UNIQUE references auth.users(id)  -- map auth → member (null nếu chưa link tài khoản)
full_name          text NOT NULL
email              text UNIQUE                            -- match với auth.users.email khi login
phone              text UNIQUE
avatar_url         text
avatar_updated_at  timestamptz                            -- cache busting cho CDN
skill_level        text CHECK (skill_level IN ('A','B+','B-','C')) NOT NULL
zalo_id            text
bio                text
is_admin           boolean default false                  -- source of truth cho admin role
is_active          boolean default true                   -- soft delete
joined_at          timestamptz default now()
created_by         uuid references auth.users(id)
updated_at         timestamptz default now()
skill_updated_by   uuid references auth.users(id)
skill_updated_at   timestamptz default now()
```

Indexes:
```sql
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_is_active ON members(is_active) WHERE is_active = true;
```

### `surveys`
```sql
id           uuid PK default gen_random_uuid()
title        text NOT NULL
description  text
type         text CHECK (type IN ('jersey','tournament','attendance','custom'))
fields_schema jsonb NOT NULL   -- array of FieldSchema, xem format bên dưới
closes_at    timestamptz
is_open      boolean default true
created_by   uuid references auth.users(id)
created_at   timestamptz default now()
```

### `survey_responses`
```sql
id           uuid PK default gen_random_uuid()
survey_id    uuid references surveys(id) ON DELETE CASCADE
member_id    uuid references members(id)
answers      jsonb NOT NULL
submitted_at timestamptz default now()
UNIQUE(survey_id, member_id)
```

### `tournaments`
```sql
id           uuid PK default gen_random_uuid()
name         text NOT NULL
description  text
format       text CHECK (format IN ('round_robin','single_elim','double_elim','custom'))
skill_filter text[]   -- ['A','B+'] hoặc null = mở tất cả
event_date   date
venue        text
max_teams    int
status       text CHECK (status IN ('draft','open','ongoing','completed')) default 'draft'
winner_ids   uuid[]   -- set khi status='completed', null trước đó
created_by   uuid references auth.users(id)
created_at   timestamptz default now()
```

### `tournament_registrations`
```sql
id            uuid PK default gen_random_uuid()
tournament_id uuid references tournaments(id) ON DELETE CASCADE
member_id     uuid references members(id)
partner_id    uuid references members(id)   -- null nếu singles
category      text   -- 'mens_doubles','womens_doubles','mixed','singles'
status        text CHECK (status IN ('pending','confirmed','withdrawn')) default 'pending'
is_mirror     boolean default false   -- true nếu auto-tạo cho partner
registered_at timestamptz default now()
UNIQUE(tournament_id, member_id)
```

**Doubles flow:** khi A đăng ký với partner B → tạo 1 record cho A. Khi admin **confirm**, system auto-tạo mirror record cho B (`member_id=B, partner_id=A, is_mirror=true, status='confirmed'`). Khi withdraw → cascade cả 2.

### `tournament_matches`
```sql
id            uuid PK default gen_random_uuid()
tournament_id uuid references tournaments(id) ON DELETE CASCADE
round         text   -- 'Round Robin','Quarter Final','Semi Final','Final'
team_a_ids    uuid[] NOT NULL   -- array of member ids (PG không support FK trên array)
team_b_ids    uuid[] NOT NULL
score_a       int                -- null nếu chưa đấu
score_b       int
winner_ids    uuid[]             -- null nếu chưa có kết quả
played_at     timestamptz
court         text
```

Indexes:
```sql
CREATE INDEX idx_matches_tournament ON tournament_matches(tournament_id);
```

---

## FieldSchema format (cho `surveys.fields_schema`)

```ts
type FieldSchema = {
  key: string                                          // unique key trong form
  label: string                                        // hiển thị cho user
  type: 'single_select' | 'number' | 'text' | 'textarea' | 'yes_no'
  options?: string[]                                   // bắt buộc nếu type='single_select'
  required?: boolean                                   // default false
  default?: string | number | boolean
  min?: number                                         // chỉ cho type='number'
  max?: number
  placeholder?: string
}

// `surveys.fields_schema` luôn là FieldSchema[]
```

Validation: client-side dùng Zod, generate schema từ FieldSchema[] runtime.

---

## Survey templates (built-in)

**Template: jersey** (Đặt áo)
```json
[
  {"key":"size","label":"Size","type":"single_select","options":["S","M","L","XL","XXL"],"required":true},
  {"key":"quantity","label":"Số lượng","type":"number","default":1,"min":1,"max":10,"required":true},
  {"key":"name_on_jersey","label":"Tên in áo","type":"text","required":true},
  {"key":"notes","label":"Ghi chú","type":"textarea"}
]
```

**Template: tournament** (Đăng ký giải)
```json
[
  {"key":"category","label":"Hạng mục","type":"single_select","options":["Nam đôi","Nữ đôi","Hỗn hợp"],"required":true},
  {"key":"partner_name","label":"Tên partner ghép cặp","type":"text"},
  {"key":"shirt_size","label":"Size áo","type":"single_select","options":["S","M","L","XL"],"required":true},
  {"key":"notes","label":"Ghi chú","type":"textarea"}
]
```

**Template: attendance** (Điểm danh / đi ăn)
```json
[
  {"key":"attending","label":"Tham gia?","type":"yes_no","required":true},
  {"key":"plus_one","label":"Đem theo người","type":"yes_no"},
  {"key":"notes","label":"Ghi chú","type":"textarea"}
]
```

Admin tạo survey → chọn template → edit title/description/closes_at → publish.
Thành viên xem list → bấm vào → điền form → submit (1 người 1 lần).
Admin xem kết quả: tổng hợp + danh sách từng người + export CSV.

---

## RLS policies (ready-to-paste SQL)

```sql
-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- Helper function: check current user is admin
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid() AND is_admin = true AND is_active = true
  );
$$;

-- members
CREATE POLICY "members_select_all" ON members FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "members_update_own" ON members FOR UPDATE
  TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND is_admin = (SELECT is_admin FROM members WHERE id = members.id));
CREATE POLICY "members_admin_all" ON members FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- surveys
CREATE POLICY "surveys_select_all" ON surveys FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "surveys_admin_write" ON surveys FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- survey_responses
CREATE POLICY "responses_select_all" ON survey_responses FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "responses_insert_own" ON survey_responses FOR INSERT
  TO authenticated WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );
CREATE POLICY "responses_admin_all" ON survey_responses FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- tournaments
CREATE POLICY "tournaments_select_all" ON tournaments FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "tournaments_admin_write" ON tournaments FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- tournament_registrations
CREATE POLICY "regs_select_all" ON tournament_registrations FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "regs_insert_own" ON tournament_registrations FOR INSERT
  TO authenticated WITH CHECK (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );
CREATE POLICY "regs_admin_all" ON tournament_registrations FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- tournament_matches
CREATE POLICY "matches_select_all" ON tournament_matches FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "matches_admin_write" ON tournament_matches FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

**Storage policies** (bucket `avatars`):
```sql
-- Anyone authenticated can read
CREATE POLICY "avatars_read" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'avatars');
-- User upload chỉ vào file của member họ
CREATE POLICY "avatars_write_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM members WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "avatars_admin_all" ON storage.objects FOR ALL
  TO authenticated USING (bucket_id = 'avatars' AND is_admin())
  WITH CHECK (bucket_id = 'avatars' AND is_admin());
```

---

## App structure

```
src/
  components/
    layout/       BottomNav, TopBar, Layout
    members/      MemberCard, MemberAvatar, SkillBadge, MemberForm
    surveys/      SurveyList, SurveyCard, SurveyForm, ResponseView, FieldRenderer
    tournaments/  TournamentCard, Bracket, RegistrationForm, MatchCard
    ui/           Button, Input, Select, Modal, Toast, Badge
  pages/
    LoginPage
    MembersPage
    MemberDetailPage
    SurveysPage
    SurveyDetailPage
    TournamentsPage
    TournamentDetailPage
    AdminPage
  lib/
    supabase.ts
    storage.ts    -- avatar upload helpers
    bracket.ts    -- pure functions: generateRoundRobin, generateSingleElim
    csv.ts        -- export helpers
    schema.ts     -- FieldSchema → Zod schema generator
  hooks/
    useMembers, useSurveys, useTournaments, useAuth
```

---

## Feature specs

### 1. Members
- List view: avatar + tên + skill badge (A=green, B+=blue, B-=amber, C=gray)
- Filter theo skill level, search theo tên
- Profile page: avatar lớn, thông tin, lịch sử giải, số buổi tham gia
- Avatar: upload ảnh → resize về 400x400 webp → lưu Supabase Storage
- Skill update: chỉ admin mới đổi được, log `skill_updated_by` + `skill_updated_at`
- Member tự edit được: bio, zalo_id, phone, avatar của chính mình (RLS enforce)
- `is_active = false` → ẩn khỏi list mặc định, admin xem được trong tab "Inactive"

### 2. Surveys (Khảo sát)
- Admin tạo từ 3 template sẵn (jersey/tournament/attendance) hoặc custom
- Render form động từ `fields_schema`
- Validation client-side bằng Zod (auto-generate từ FieldSchema[])
- 1 member chỉ submit được 1 lần (UNIQUE constraint)
- Admin xem: aggregate + table response từng người + export CSV

### 3. Tournaments (Giải đấu)
- Admin tạo: tên, thể thức, ngày, sân, skill filter, max teams
- Member đăng ký: chọn category + ghi partner
- Admin confirm → auto-tạo mirror registration cho partner
- Bracket view: round robin table hoặc single elim tree
- Nhập kết quả từng trận → auto-update `winner_ids`
- Khi status='completed', set `tournaments.winner_ids`

### 4. Admin panel
- Dashboard: tổng thành viên, khảo sát đang mở, giải đang diễn ra
- Tab Members: CRUD, cập nhật skill, soft delete (`is_active`)
- Tab Surveys: tạo từ template, mở/đóng, xem responses
- Tab Tournaments: tạo, confirm đăng ký, nhập kết quả

---

## Auth
- Supabase Auth với **magic link email** (chốt 1 phương thức, không OTP phone)
- Khi user login lần đầu: lookup `members.email = auth.users.email` → nếu match thì auto-update `members.user_id = auth.uid()`
- Nếu không match: redirect về trang "Liên hệ admin để được add vào hệ thống"
- Role admin: check `members.is_admin = true` (qua hook `useAuth`)
- RLS enforce ở DB level — frontend chỉ là UX layer

## Mobile UX rules
- Bottom navigation: Members / Surveys / Tournaments / Admin (admin chỉ hiện nếu `is_admin`)
- Touch targets tối thiểu 44px
- Avatar dùng lazy loading
- Form submit có loading state + toast feedback
- Pull-to-refresh trên list pages

## Image / Avatar
- Accept: jpg, png, webp, max 5MB
- Client-side resize (canvas) về 400x400 webp, quality 0.85, trước khi upload
- Storage path: `avatars/{member_id}/{timestamp}.webp` — folder per member để policy work + cache bust
- Khi upload mới: xoá file cũ (list folder → delete) → upload mới → update `avatar_url` + `avatar_updated_at`
- Fallback UI: initials circle với màu từ hash của tên

## Notifications (out of scope MVP)
- Survey mới mở / giải mới mở → thông báo qua Zalo group thủ công (admin tự post link)
- Có thể add Telegram bot / Web Push ở Phase 6 sau

## Environment variables
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

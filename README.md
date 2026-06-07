# Pickleball Community App

Web app quản lý cộng đồng pickleball nội bộ (~100 thành viên).
Mobile-first, PWA-ready. Brand color: `#1D9E75`.

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind v3
- **Backend:** Supabase (Auth + PostgreSQL + Storage)
- **Deploy:** Vercel

## Setup

```bash
# Cài deps
npm install

# Tạo .env.local từ template
cp .env.example .env.local
# Điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

# Chạy SQL trong Supabase SQL Editor (theo thứ tự)
sql/01_schema.sql
sql/02_rls.sql
sql/03_storage.sql      # tạo bucket "avatars" trong UI trước
sql/04_seed.sql
sql/05_auth_link.sql
sql/06_add_roles.sql

# Run dev
npm run dev
```

## Project structure

```
src/
  components/
    layout/       BottomNav, TopBar, Layout, ProtectedRoute
    members/      MemberCard, MemberAvatar, SkillBadge, RoleBadges, MemberForm
    ui/           Button, Input, Modal
  pages/
    LoginPage, MembersPage, MemberDetailPage,
    SurveysPage, TournamentsPage, AdminPage
  hooks/          useAuth
  lib/            supabase, storage, cn
  types/          database.ts
sql/              SQL migrations (paste vào Supabase SQL Editor)
```

## Features

### Phase 1 — Foundation (done)
- Auth (magic link email + password)
- Member list với skill + role filter
- Bottom navigation 4 tabs (Members / Surveys / Tournaments / Admin)

### Phase 2 — Members (done)
- Member detail page (view + self-edit)
- Avatar upload (auto-resize 400x400 webp)
- Roles: Admin / Coach / Host (multi-role)
- Admin CRUD: thêm / sửa / soft delete members

### Phase 3 — Surveys (todo)
Dynamic form, jersey/tournament/attendance templates, CSV export

### Phase 4 — Tournaments (todo)
Round robin + single elim bracket, match results, BXH

### Phase 5 — Polish & Deploy (todo)
PWA, skeletons, Vercel deploy

## Database schema

6 tables: `members`, `surveys`, `survey_responses`, `tournaments`, `tournament_registrations`, `tournament_matches`.

Xem `CLAUDE.md` cho spec đầy đủ.

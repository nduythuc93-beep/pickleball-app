# SQL Migrations

Linear migration history of the Supabase database. Each numbered file is a self-contained migration. Run them **in order** when setting up a fresh database.

## Quick setup for a new Supabase project

Open Supabase Dashboard → SQL Editor, and run each file **in numeric order** (01 → 29). Files marked **DEPRECATED** can be skipped — they are kept for history but their changes are subsumed by later migrations.

```
01_schema.sql                 → Core tables (members, surveys, tournaments…)
02_rls.sql                    → Initial RLS policies
03_storage.sql                → Avatar storage bucket + policies
04_seed.sql                   → 1 admin member (edit emails!)
05_auth_link.sql              → handle_new_user() trigger
06_add_roles.sql              → is_coach / is_host columns
07_fix_rls_phase3.sql         → RLS fixes
08_fix_storage_admin.sql      → Storage admin policy fix
09_tournament_banner.sql      → Tournament banner upload
10_social_sessions.sql        → play_sessions + session_checkins
11_cancel_checkin_rpc.sql     → DEPRECATED → superseded by 26 + 28
12_auto_cron.sql              → pg_cron auto-generate sessions
13_fix_dedup.sql              → DEPRECATED → superseded by 14
14_force_dedup.sql            → Session dedup logic
15_signup_rpc.sql             → DEPRECATED → superseded by 16/18/19/20/27
16_play_experience.sql        → play_experience column
17_rewards.sql                → Rewards + redemptions tables
18_add_gender.sql             → DEPRECATED → superseded by 19
19_walkin_and_announcements.sql → walk_in_checkins + announcements + signup updates
20_phone_required.sql         → Phone required in signup
21_in_app_notifications.sql   → notifications table
22_anon_read_public_tables.sql → Anon RLS for landing page
23_walkin_per_session.sql     → walk-in UNIQUE per session
24_walkin_read_authenticated.sql → walk-in read policy
25_walkin_paid_and_remove_water.sql → is_paid + remove water reward
26_warning_and_cancel_rules.sql → cancel_my_checkin + warning RPCs
27_skill_level_dupr.sql       → A/B+/B-/C → 2.0/2.5/2.75/3.0+ (DUPR)
28_host_opt_outs.sql          → Host opt-out + walk_in_checkins index
29_get_home_data.sql          → get_home_data() RPC (HomePage 1-RTT)
```

## How to identify the current state of a function

`signup_member` was rewritten in 15 → 16 → 18 → 19 → 20 → 27. The **latest** definition (27) is the one in the database. Look at the most recent migration touching a function/table.

## Adding a new migration

1. Name it `30_<short_name>.sql` (next sequential number)
2. Use `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS` so it's idempotent
3. End with `NOTIFY pgrst, 'reload schema';` if you touched RPCs
4. Optionally add a verification `SELECT` at the bottom
5. Update this README

## What's NOT in here

- Storage bucket creation outside Supabase Dashboard (run via UI: `avatars`, `tournament-banners`)
- Cron schedule for `auto_generate_sessions` — set via Dashboard → Cron
- Edge functions (if any added later)

## When to consolidate

If we ever hit > 50 migrations or migrations become hard to follow, write a single `00_consolidated_schema.sql` that represents the final state. For now, the linear history is manageable.

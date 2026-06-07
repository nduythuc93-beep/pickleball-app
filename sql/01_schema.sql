-- ========================================
-- Pickleball App — Schema
-- Paste toàn bộ file này vào Supabase SQL Editor → Run
-- ========================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- MEMBERS
-- ========================================
CREATE TABLE IF NOT EXISTS members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name          text NOT NULL,
  email              text UNIQUE,
  phone              text UNIQUE,
  avatar_url         text,
  avatar_updated_at  timestamptz,
  skill_level        text NOT NULL CHECK (skill_level IN ('A','B+','B-','C')),
  zalo_id            text,
  bio                text,
  is_admin           boolean NOT NULL DEFAULT false,
  is_active          boolean NOT NULL DEFAULT true,
  joined_at          timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  skill_updated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  skill_updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_active ON members(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_members_skill ON members(skill_level);

-- ========================================
-- SURVEYS
-- ========================================
CREATE TABLE IF NOT EXISTS surveys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  description   text,
  type          text NOT NULL CHECK (type IN ('jersey','tournament','attendance','custom')),
  fields_schema jsonb NOT NULL,
  closes_at     timestamptz,
  is_open       boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surveys_open ON surveys(is_open) WHERE is_open = true;

-- ========================================
-- SURVEY RESPONSES
-- ========================================
CREATE TABLE IF NOT EXISTS survey_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  answers      jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_member ON survey_responses(member_id);

-- ========================================
-- TOURNAMENTS
-- ========================================
CREATE TABLE IF NOT EXISTS tournaments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  format       text NOT NULL CHECK (format IN ('round_robin','single_elim','double_elim','custom')),
  skill_filter text[],
  event_date   date,
  venue        text,
  max_teams    int,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','ongoing','completed')),
  winner_ids   uuid[],
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- ========================================
-- TOURNAMENT REGISTRATIONS
-- ========================================
CREATE TABLE IF NOT EXISTS tournament_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  partner_id    uuid REFERENCES members(id) ON DELETE SET NULL,
  category      text CHECK (category IN ('mens_doubles','womens_doubles','mixed','singles')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','withdrawn')),
  is_mirror     boolean NOT NULL DEFAULT false,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_regs_tournament ON tournament_registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_regs_member ON tournament_registrations(member_id);

-- ========================================
-- TOURNAMENT MATCHES
-- ========================================
CREATE TABLE IF NOT EXISTS tournament_matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         text NOT NULL,
  team_a_ids    uuid[] NOT NULL,
  team_b_ids    uuid[] NOT NULL,
  score_a       int,
  score_b       int,
  winner_ids    uuid[],
  played_at     timestamptz,
  court         text
);

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON tournament_matches(tournament_id);

-- ========================================
-- TRIGGERS — auto update timestamps
-- ========================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ========================================
-- DONE
-- ========================================
-- Check tables:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

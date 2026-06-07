export type SkillLevel = 'A' | 'B+' | 'B-' | 'C'

export type Member = {
  id: string
  user_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  avatar_updated_at: string | null
  skill_level: SkillLevel
  zalo_id: string | null
  bio: string | null
  is_admin: boolean
  is_coach: boolean
  is_host: boolean
  is_active: boolean
  joined_at: string
  created_by: string | null
  updated_at: string
  skill_updated_by: string | null
  skill_updated_at: string
}

export type FieldSchema = {
  key: string
  label: string
  type: 'single_select' | 'number' | 'text' | 'textarea' | 'yes_no'
  options?: string[]
  required?: boolean
  default?: string | number | boolean
  min?: number
  max?: number
  placeholder?: string
}

export type Survey = {
  id: string
  title: string
  description: string | null
  type: 'jersey' | 'tournament' | 'attendance' | 'custom'
  fields_schema: FieldSchema[]
  closes_at: string | null
  is_open: boolean
  created_by: string | null
  created_at: string
}

export type SurveyResponse = {
  id: string
  survey_id: string
  member_id: string
  answers: Record<string, unknown>
  submitted_at: string
}

export type TournamentFormat = 'round_robin' | 'single_elim' | 'double_elim' | 'custom'
export type TournamentStatus = 'draft' | 'open' | 'ongoing' | 'completed'

export type Tournament = {
  id: string
  name: string
  description: string | null
  format: TournamentFormat
  skill_filter: SkillLevel[] | null
  event_date: string | null
  venue: string | null
  max_teams: number | null
  status: TournamentStatus
  winner_ids: string[] | null
  banner_url: string | null
  banner_updated_at: string | null
  created_by: string | null
  created_at: string
}

export type TournamentRegistration = {
  id: string
  tournament_id: string
  member_id: string
  partner_id: string | null
  category: 'mens_doubles' | 'womens_doubles' | 'mixed' | 'singles' | null
  status: 'pending' | 'confirmed' | 'withdrawn'
  is_mirror: boolean
  registered_at: string
}

export type TournamentMatch = {
  id: string
  tournament_id: string
  round: string
  team_a_ids: string[]
  team_b_ids: string[]
  score_a: number | null
  score_b: number | null
  winner_ids: string[] | null
  played_at: string | null
  court: string | null
}

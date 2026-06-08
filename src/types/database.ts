export type SkillLevel = 'A' | 'B+' | 'B-' | 'C'

export type PlayExperience = 'beginner' | 'under_6m' | 'over_6m'

export const PLAY_EXPERIENCE_LABEL: Record<PlayExperience, string> = {
  beginner: 'Chưa biết chơi',
  under_6m: 'Dưới 6 tháng',
  over_6m: 'Trên 6 tháng',
}

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
  play_experience: PlayExperience | null
  is_admin: boolean
  is_coach: boolean
  is_host: boolean
  is_active: boolean
  total_points: number
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

// ========================================
// SOCIAL PLAY SESSIONS
// ========================================

export type ActivityTypeKey = 'social' | 'training' | 'ball_machine'

export type ActivityType = {
  key: ActivityTypeKey
  label: string
  default_price_vnd: number
  default_points: number
  color: string | null
  icon: string | null
  requires_instructor: boolean
  display_order: number
}

export type SessionSchedule = {
  id: string
  activity_type: ActivityTypeKey
  day_of_week: number // 1=Mon, 7=Sun
  start_time: string // 'HH:MM:SS'
  end_time: string
  venue: string
  max_attendees: number
  price_vnd: number | null
  points_award: number | null
  instructor_name: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export type SessionStatus = 'open' | 'ongoing' | 'completed' | 'cancelled'

export type PlaySession = {
  id: string
  activity_type: ActivityTypeKey
  session_date: string // 'YYYY-MM-DD'
  start_time: string
  end_time: string
  venue: string
  max_attendees: number
  price_vnd: number
  points_award: number
  instructor_name: string | null
  status: SessionStatus
  notes: string | null
  schedule_id: string | null
  created_by: string | null
  created_at: string
}

export type SessionCheckin = {
  id: string
  session_id: string
  member_id: string
  checked_in_at: string
  points_awarded: number
  is_paid: boolean
  paid_at: string | null
  paid_marked_by: string | null
  checked_in_by: string | null
}

// ========================================
// REWARDS
// ========================================

export type Reward = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  image_updated_at: string | null
  cost_points: number
  stock: number | null
  is_active: boolean
  display_order: number
  created_by: string | null
  created_at: string
}

export type RedemptionStatus = 'pending' | 'delivered' | 'cancelled'

export type RewardRedemption = {
  id: string
  reward_id: string | null
  member_id: string
  cost_points: number
  reward_name: string
  status: RedemptionStatus
  notes: string | null
  redeemed_at: string
  delivered_at: string | null
  delivered_by: string | null
  cancelled_at: string | null
  cancelled_by: string | null
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import {
  LogOut,
  ChevronRight,
  ClipboardList,
  Trophy,
  Users,
  Award,
  Activity as ActivityIcon,
  Calendar,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Plus,
  Gift,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { SkillBadge } from '../components/members/SkillBadge'
import { SessionCardHero, SessionCardMini, type AttendeeLite } from '../components/sessions/SessionCard'
import { AnnouncementBanner } from '../components/announcements/AnnouncementBanner'
import { cn } from '../lib/cn'
import type {
  ActivityType,
  Member,
  PlaySession,
  SessionCheckin,
  Survey,
  Tournament,
  TournamentMatch,
  TournamentRegistration,
} from '../types/database'

type ActivityItem = {
  id: string
  type: 'match' | 'registration'
  timestamp: string
  title: string
  subtitle?: string
  href: string
}

type Scorer = {
  member: Member
  wins: number
}

const greetingByHour = (h: number) => {
  if (h < 11) return 'Chào buổi sáng'
  if (h < 13) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

// Tournament: ALL gold/amber/orange theme (trophy concept)
// → phân biệt rõ với Social hero (emerald/teal)
const formatGradient: Record<string, string> = {
  round_robin: 'bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600',
  single_elim: 'bg-gradient-to-br from-orange-500 via-red-500 to-rose-600',
  double_elim: 'bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-600',
  custom: 'bg-gradient-to-br from-stone-500 via-stone-600 to-stone-800',
}

const statusByStatus: Record<string, string> = {
  ongoing: 'bg-gradient-to-br from-red-500 via-rose-500 to-pink-600',
  open: '',
  draft: '',
  completed: '',
}

function getTournamentGradient(t: Tournament) {
  return statusByStatus[t.status] || formatGradient[t.format] || formatGradient.custom
}

export function HomePage() {
  const { member: me, user, isAdmin, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [myResponded, setMyResponded] = useState<Set<string>>(new Set())
  const [myRegistrations, setMyRegistrations] = useState<Set<string>>(new Set())
  const [topScorers, setTopScorers] = useState<Scorer[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [todaySessions, setTodaySessions] = useState<PlaySession[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [sessionCheckinCounts, setSessionCheckinCounts] = useState<Record<string, number>>({})
  const [sessionWalkInCounts, setSessionWalkInCounts] = useState<Record<string, number>>({})
  const [sessionAttendees, setSessionAttendees] = useState<Record<string, AttendeeLite[]>>({})
  const [hostCoachMembers, setHostCoachMembers] = useState<AttendeeLite[]>([])
  const [mySessionCheckins, setMySessionCheckins] = useState<Set<string>>(new Set())
  const [myOptOuts, setMyOptOuts] = useState<Set<string>>(new Set())
  const [quickCheckinId, setQuickCheckinId] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!me) return
      const today = new Date().toISOString().slice(0, 10)
      const [
        { data: t },
        { data: s },
        { data: members, count: memberCount },
        { data: matches },
        { data: regs },
        { data: myResps },
        { data: myRegs },
        { data: todaySess },
        { data: at },
        { data: sessCi },
        { data: mySessCi },
        { data: sessWi },
        { data: hostsCoaches },
        { data: optOuts },
      ] = await Promise.all([
        supabase
          .from('tournaments')
          .select('*')
          .neq('status', 'completed')
          .order('event_date', { ascending: true, nullsFirst: false })
          .limit(5),
        supabase
          .from('surveys')
          .select('*')
          .eq('is_open', true)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('members')
          .select('*', { count: 'exact' })
          .eq('is_active', true),
        supabase
          .from('tournament_matches')
          .select('*')
          .not('winner_ids', 'is', null)
          .order('played_at', { ascending: false })
          .limit(50),
        supabase
          .from('tournament_registrations')
          .select(
            '*, tournaments!inner(id, name), members!tournament_registrations_member_id_fkey(full_name)'
          )
          .eq('status', 'confirmed')
          .eq('is_mirror', false)
          .order('registered_at', { ascending: false })
          .limit(5),
        supabase.from('survey_responses').select('survey_id').eq('member_id', me.id),
        supabase
          .from('tournament_registrations')
          .select('tournament_id')
          .eq('member_id', me.id)
          .neq('status', 'withdrawn'),
        supabase
          .from('play_sessions')
          .select('*')
          .gte('session_date', today)
          .lte('session_date', new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
          .neq('status', 'cancelled')
          .order('session_date')
          .order('start_time')
          .limit(20),
        supabase.from('activity_types').select('*').order('display_order'),
        supabase
          .from('session_checkins')
          .select(
            'session_id, members(id, full_name, avatar_url, avatar_updated_at, is_host, is_coach)'
          ),
        supabase.from('session_checkins').select('session_id').eq('member_id', me.id),
        supabase.from('walk_in_checkins').select('session_id'),
        supabase
          .from('members')
          .select('id, full_name, avatar_url, avatar_updated_at, is_host, is_coach')
          .or('is_host.eq.true,is_coach.eq.true')
          .eq('is_active', true),
        supabase
          .from('session_host_opt_outs')
          .select('session_id')
          .eq('member_id', me.id),
      ])
      if (!mounted) return

      setTournaments((t ?? []) as Tournament[])
      setSurveys((s ?? []) as Survey[])
      void memberCount
      setTodaySessions((todaySess ?? []) as PlaySession[])
      setActivityTypes((at ?? []) as ActivityType[])
      type CiRow = Pick<SessionCheckin, 'session_id'> & {
        members: AttendeeLite | AttendeeLite[] | null
      }
      const sessCounts: Record<string, number> = {}
      const sessAttendees: Record<string, AttendeeLite[]> = {}
      for (const c of (sessCi ?? []) as unknown as CiRow[]) {
        sessCounts[c.session_id] = (sessCounts[c.session_id] ?? 0) + 1
        const m = Array.isArray(c.members) ? c.members[0] : c.members
        if (m) {
          ;(sessAttendees[c.session_id] ??= []).push(m)
        }
      }
      setSessionCheckinCounts(sessCounts)
      setSessionAttendees(sessAttendees)

      // Walk-in counts per session
      const wiCounts: Record<string, number> = {}
      for (const w of (sessWi ?? []) as Array<{ session_id: string | null }>) {
        if (!w.session_id) continue
        wiCounts[w.session_id] = (wiCounts[w.session_id] ?? 0) + 1
      }
      setSessionWalkInCounts(wiCounts)

      setHostCoachMembers((hostsCoaches ?? []) as AttendeeLite[])
      setMySessionCheckins(new Set((mySessCi ?? []).map((r) => r.session_id as string)))
      setMyOptOuts(new Set((optOuts ?? []).map((r) => r.session_id as string)))
      setMyResponded(new Set((myResps ?? []).map((r) => r.survey_id as string)))
      setMyRegistrations(
        new Set((myRegs ?? []).map((r) => r.tournament_id as string))
      )

      // Top scorers
      const memberMap = new Map<string, Member>()
      for (const m of (members ?? []) as Member[]) memberMap.set(m.id, m)
      const winCounts = new Map<string, number>()
      for (const m of (matches ?? []) as TournamentMatch[]) {
        for (const id of m.winner_ids ?? []) {
          winCounts.set(id, (winCounts.get(id) ?? 0) + 1)
        }
      }
      const scorers: Scorer[] = Array.from(winCounts.entries())
        .map(([memberId, wins]) => ({ member: memberMap.get(memberId)!, wins }))
        .filter((s) => s.member)
        .sort((a, b) => b.wins - a.wins)
        .slice(0, 5)
      setTopScorers(scorers)

      // Activity
      const acts: ActivityItem[] = []
      for (const m of (matches ?? []) as TournamentMatch[]) {
        if (!m.played_at || !m.winner_ids) continue
        const winnerNames = m.winner_ids
          .map((id) => memberMap.get(id)?.full_name ?? '?')
          .join(' & ')
        acts.push({
          id: `match-${m.id}`,
          type: 'match',
          timestamp: m.played_at,
          title: `🏆 ${winnerNames} thắng`,
          subtitle: `${m.score_a}-${m.score_b} · ${m.round}`,
          href: `/tournaments/${m.tournament_id}`,
        })
      }
      type RegRow = TournamentRegistration & {
        tournaments: { id: string; name: string } | null
        members: { full_name: string } | null
      }
      for (const r of (regs ?? []) as RegRow[]) {
        acts.push({
          id: `reg-${r.id}`,
          type: 'registration',
          timestamp: r.registered_at,
          title: `📝 ${r.members?.full_name ?? '?'} đăng ký giải`,
          subtitle: r.tournaments?.name,
          href: `/tournaments/${r.tournament_id}`,
        })
      }
      acts.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      setActivity(acts.slice(0, 8))

      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [me, reloadTick])

  // Auto-check-in cho Host vào tất cả Social sessions trong tương lai
  // (Host mặc định luôn có mặt — không cần thao tác)
  // EXCEPTION: Host đã chủ động huỷ check-in → tôn trọng opt-out
  useEffect(() => {
    if (!me || !me.is_host) return
    if (todaySessions.length === 0) return

    const nowMs = Date.now()
    const candidates = todaySessions.filter(
      (s) =>
        s.activity_type === 'social' &&
        s.status !== 'cancelled' &&
        new Date(`${s.session_date}T${s.end_time}`).getTime() > nowMs &&
        !mySessionCheckins.has(s.id) &&
        !myOptOuts.has(s.id) // ❗ skip nếu host đã opt-out
    )
    if (candidates.length === 0) return

    let cancelled = false
    async function autoCheckin() {
      if (!me) return
      const rows = candidates.map((s) => ({
        session_id: s.id,
        member_id: me.id,
        points_awarded: s.points_award,
        checked_in_by: user?.id ?? null,
      }))
      const { error } = await supabase
        .from('session_checkins')
        .upsert(rows, { onConflict: 'session_id,member_id', ignoreDuplicates: true })
      if (cancelled) return
      if (!error) {
        setReloadTick((t) => t + 1)
      }
    }
    autoCheckin()
    return () => {
      cancelled = true
    }
  }, [me, todaySessions, mySessionCheckins, myOptOuts, user])

  const handleQuickCheckin = useCallback(
    async (session: PlaySession) => {
      if (!me) return
      setQuickCheckinId(session.id)
      const { error } = await supabase.from('session_checkins').insert({
        session_id: session.id,
        member_id: me.id,
        points_awarded: session.points_award,
        checked_in_by: user?.id ?? null,
      })
      setQuickCheckinId(null)
      if (error) {
        toast.error(friendlyError(error))
        return
      }
      toast.success(
        session.points_award > 0
          ? `Check-in thành công! +${session.points_award} điểm 🎉`
          : 'Check-in thành công!'
      )
      setReloadTick((t) => t + 1)
    },
    [me, user]
  )

  const pendingSurveys = useMemo(
    () => surveys.filter((s) => !myResponded.has(s.id)).length,
    [surveys, myResponded]
  )
  const featuredTournaments = useMemo(
    () => tournaments.filter((t) => t.status === 'open' || t.status === 'ongoing'),
    [tournaments]
  )

  const now = new Date()

  if (!me) return null

  return (
    <div className="pb-6 bg-gray-50">
      {/* Compact greeting bar */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3 bg-white">
        <MemberAvatar member={me} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-500 font-medium">
            {greetingByHour(now.getHours())}
          </p>
          <h1 className="text-base font-bold text-gray-900 truncate leading-tight">
            {me.full_name} 👋
          </h1>
        </div>
        <button
          onClick={signOut}
          className="p-2 -mr-2 rounded-lg text-gray-400 hover:bg-gray-100"
          aria-label="Đăng xuất"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Thông báo */}
      <AnnouncementBanner />

      {/* Sự kiện sắp tới — next upcoming sessions (auto cuộn sang buổi sau khi end) */}
      {(() => {
        const nowMs = Date.now()
        const upcoming = todaySessions.filter((s) => {
          const end = new Date(`${s.session_date}T${s.end_time}`).getTime()
          return end > nowMs
        })
        if (upcoming.length === 0) return null

        // Tìm buổi social gần nhất chưa end (làm hero)
        const nextSocial = upcoming.find((s) => s.activity_type === 'social')
        const nextSocialDate = nextSocial?.session_date

        // Mini grid: training + ball_machine CÙNG NGÀY với social hero
        const sameDayOthers = nextSocialDate
          ? upcoming.filter(
              (s) => s.session_date === nextSocialDate && s.activity_type !== 'social'
            )
          : upcoming.filter((s) => s.activity_type !== 'social').slice(0, 2)

        // Hiển thị buổi social hero + same-day others
        return (
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Sự kiện sắp tới
              </h2>
              <Link to="/events" className="text-xs text-primary font-semibold">
                Xem tất cả →
              </Link>
            </div>
            <div className="space-y-2">
              {nextSocial && (
                <SessionCardHero
                  session={nextSocial}
                  activityType={activityTypes.find((a) => a.key === nextSocial.activity_type)}
                  checkinCount={sessionCheckinCounts[nextSocial.id] ?? 0}
                  walkInCount={sessionWalkInCounts[nextSocial.id] ?? 0}
                  hasCheckedIn={mySessionCheckins.has(nextSocial.id)}
                  attendees={sessionAttendees[nextSocial.id] ?? []}
                  defaultAttendees={
                    nextSocial.activity_type === 'social' ? hostCoachMembers : []
                  }
                  onQuickCheckin={() => handleQuickCheckin(nextSocial)}
                  quickCheckinLoading={quickCheckinId === nextSocial.id}
                />
              )}
              {sameDayOthers.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {sameDayOthers.map((s) => (
                    <SessionCardMini
                      key={s.id}
                      session={s}
                      activityType={activityTypes.find((a) => a.key === s.activity_type)}
                      checkinCount={sessionCheckinCounts[s.id] ?? 0}
                      walkInCount={sessionWalkInCounts[s.id] ?? 0}
                      hasCheckedIn={mySessionCheckins.has(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Đổi quà CTA — NGAY SAU sessions */}
      <div className="px-4 mt-4">
        <Link
          to="/rewards"
          className="block bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 rounded-2xl p-4 text-white shadow-md relative overflow-hidden hover:shadow-lg transition-shadow"
        >
          <Gift className="absolute -right-6 -bottom-6 w-32 h-32 opacity-20" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl">
              🎁
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">
                Đổi điểm lấy quà
              </p>
              <p className="text-base font-bold">Bạn có {me.total_points ?? 0}đ</p>
              <p className="text-[11px] opacity-90">Xem catalog quà →</p>
            </div>
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <StatCard
          to="/surveys"
          icon={ClipboardList}
          label="Khảo sát"
          value={pendingSurveys}
          accent={pendingSurveys > 0 ? 'red' : 'gray'}
          sub={pendingSurveys > 0 ? 'chưa điền' : 'all done ✓'}
        />
        <StatCard
          to="/tournaments"
          icon={Trophy}
          label="Giải đấu"
          value={tournaments.length}
          accent="primary"
          sub="đang/sắp"
        />
        <StatCard
          to={`/members/${me.id}`}
          icon={Award}
          label="Điểm của bạn"
          value={me.total_points ?? 0}
          accent="indigo"
          sub="tích luỹ"
        />
      </div>

      {/* Admin Quick Actions */}
      {isAdmin && (
        <div className="px-4 mt-5">
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-3 border border-primary/10">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Quick actions cho admin
            </p>
            <div className="grid grid-cols-3 gap-2">
              <QuickAction to="/admin" label="Khảo sát" icon={ClipboardList} />
              <QuickAction to="/admin" label="Giải đấu" icon={Trophy} />
              <QuickAction to="/admin" label="Thành viên" icon={Users} />
            </div>
          </div>
        </div>
      )}

      {/* Tournament section — đặt SAU stats, KHÔNG còn ở top */}
      {featuredTournaments.length > 0 && (
        <div className="pt-5">
          <div className="flex items-center justify-between px-4 mb-2">
            <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Giải đấu
            </h2>
            {featuredTournaments.length > 1 && (
              <span className="text-[11px] text-gray-400">Vuốt →</span>
            )}
          </div>
          <div
            className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {featuredTournaments.map((t, i) => (
              <TournamentBanner
                key={t.id}
                tournament={t}
                isRegistered={myRegistrations.has(t.id)}
                single={featuredTournaments.length === 1}
                index={i}
                total={featuredTournaments.length}
              />
            ))}
          </div>
        </div>
      )}

      {/* Surveys */}
      <Section title="📋 Khảo sát" href="/surveys" loading={loading}>
        {surveys.length === 0 ? (
          <Empty text="Chưa có khảo sát nào" />
        ) : (
          surveys.slice(0, 3).map((s) => {
            const done = myResponded.has(s.id)
            return (
              <Link
                key={s.id}
                to={`/surveys/${s.id}`}
                className="bg-white rounded-2xl p-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                    done
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
                  )}
                >
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {done
                      ? '✓ Đã điền'
                      : s.closes_at
                      ? `Hạn ${new Date(s.closes_at).toLocaleDateString('vi-VN')}`
                      : 'Đang mở'}
                  </p>
                </div>
                {!done && (
                  <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </Link>
            )
          })
        )}
      </Section>

      {/* Top scorers — podium style */}
      <Section title="🥇 Top scorer" loading={loading}>
        {topScorers.length === 0 ? (
          <Empty text="Chưa có kết quả trận nào" />
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {topScorers.map((s, i) => (
              <Link
                key={s.member.id}
                to={`/members/${s.member.id}`}
                className={cn(
                  'flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors',
                  i !== topScorers.length - 1 && 'border-b border-gray-100'
                )}
              >
                <span className="w-7 text-center text-base">
                  {i === 0 && '🥇'}
                  {i === 1 && '🥈'}
                  {i === 2 && '🥉'}
                  {i > 2 && <span className="text-xs font-bold text-gray-400">#{i + 1}</span>}
                </span>
                <MemberAvatar member={s.member} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.member.full_name}</p>
                  <p className="text-[11px] text-gray-500">
                    {s.wins} trận thắng
                  </p>
                </div>
                <SkillBadge level={s.member.skill_level} size="sm" />
                <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
                  <Award className="w-3 h-3" />
                  <span className="text-xs font-bold">{s.wins}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* Activity feed */}
      <Section title="📰 Hoạt động gần đây" loading={loading}>
        {activity.length === 0 ? (
          <Empty text="Chưa có hoạt động nào" />
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {activity.map((a, i) => (
              <Link
                key={a.id}
                to={a.href}
                className={cn(
                  'flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors',
                  i !== activity.length - 1 && 'border-b border-gray-100'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    a.type === 'match'
                      ? 'bg-amber-50 text-amber-600'
                      : 'bg-blue-50 text-blue-600'
                  )}
                >
                  <ActivityIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 leading-tight truncate">{a.title}</p>
                  {a.subtitle && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{a.subtitle}</p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap mt-1">
                  {timeAgo(a.timestamp)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function TournamentBanner({
  tournament: t,
  isRegistered,
  single,
  index,
  total,
}: {
  tournament: Tournament
  isRegistered: boolean
  single: boolean
  index: number
  total: number
}) {
  const gradient = getTournamentGradient(t)
  const isOpen = t.status === 'open'
  const isOngoing = t.status === 'ongoing'
  const hasBanner = Boolean(t.banner_url)
  const bannerSrc = hasBanner && t.banner_url
    ? `${t.banner_url}${t.banner_updated_at ? `?v=${encodeURIComponent(t.banner_updated_at)}` : ''}`
    : null

  return (
    <Link
      to={`/tournaments/${t.id}`}
      className={cn(
        'snap-center flex-shrink-0 relative overflow-hidden rounded-2xl shadow-lg text-white',
        !hasBanner && gradient,
        single ? 'w-full' : 'w-[88%]'
      )}
    >
      {/* Background ảnh nếu có, gradient nếu không */}
      {bannerSrc && (
        <img
          src={bannerSrc}
          alt={t.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {/* Decorative trophy chỉ hiện khi không có ảnh */}
      {!hasBanner && (
        <Trophy className="absolute -right-10 -top-10 w-56 h-56 opacity-10 rotate-12" />
      )}
      {/* Overlay đậm hơn nếu có ảnh để text đọc rõ */}
      <div
        className={cn(
          'absolute inset-0',
          hasBanner
            ? 'bg-gradient-to-t from-black/70 via-black/30 to-black/20'
            : 'bg-gradient-to-t from-black/30 via-transparent to-transparent'
        )}
      />

      <div className="relative p-5 h-[180px] flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            {isOngoing ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Đang diễn ra
              </>
            ) : isOpen ? (
              <>
                <Sparkles className="w-3 h-3" /> Đang mở đăng ký
              </>
            ) : (
              'Sắp diễn ra'
            )}
          </div>
          <h2 className="text-xl font-bold mt-2 leading-tight line-clamp-2 drop-shadow">
            {t.name}
          </h2>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="space-y-1 text-xs">
            {t.event_date && (
              <div className="flex items-center gap-1.5 opacity-95">
                <Calendar className="w-3.5 h-3.5" />
                <span className="font-medium">
                  {new Date(t.event_date).toLocaleDateString('vi-VN', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  })}
                </span>
              </div>
            )}
            {t.venue && (
              <div className="flex items-center gap-1.5 opacity-90">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate max-w-[140px]">{t.venue}</span>
              </div>
            )}
          </div>

          {isRegistered ? (
            <span className="bg-white/25 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-white/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đã đăng ký
            </span>
          ) : isOpen ? (
            <span className="bg-white text-gray-900 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-md">
              Đăng ký
              <ArrowRight className="w-3 h-3" />
            </span>
          ) : isOngoing ? (
            <span className="bg-white/25 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold border border-white/30">
              Xem bracket →
            </span>
          ) : null}
        </div>

        {/* Carousel indicator */}
        {!single && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all',
                  i === index ? 'w-4 bg-white' : 'w-1 bg-white/40'
                )}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  to: string
  icon: typeof ClipboardList
  label: string
  value: number
  sub: string
  accent: 'red' | 'primary' | 'gray' | 'indigo'
}) {
  const colors = {
    red: 'bg-rose-50 text-rose-600 border-rose-100',
    primary: 'bg-emerald-50 text-primary border-primary/10',
    gray: 'bg-gray-50 text-gray-600 border-gray-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  }
  return (
    <Link
      to={to}
      className={cn(
        'rounded-2xl p-3 border block hover:shadow-md transition-all relative overflow-hidden',
        colors[accent]
      )}
    >
      <Icon className="w-4 h-4 mb-1 opacity-80" />
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-[10px] mt-1 opacity-70 uppercase tracking-wide font-semibold">
        {label}
      </div>
      <div className="text-[10px] opacity-60 mt-0.5">{sub}</div>
    </Link>
  )
}

function QuickAction({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof Plus
}) {
  return (
    <Link
      to={to}
      className="bg-white border border-primary/20 rounded-xl p-2.5 flex flex-col items-center gap-1 hover:border-primary hover:bg-primary/5 text-primary transition-colors shadow-sm"
    >
      <Icon className="w-4 h-4" />
      <span className="text-[11px] font-bold">{label}</span>
    </Link>
  )
}

function Section({
  title,
  href,
  children,
  loading,
}: {
  title: string
  href?: string
  children: React.ReactNode
  loading?: boolean
}) {
  return (
    <div className="mt-6 px-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {href && (
          <Link
            to={href}
            className="text-xs text-primary font-semibold flex items-center gap-0.5"
          >
            Xem tất cả <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-2xl p-4 animate-pulse shadow-sm">
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 text-center text-xs text-gray-400 shadow-sm">
      {text}
    </div>
  )
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày`
  return new Date(iso).toLocaleDateString('vi-VN')
}

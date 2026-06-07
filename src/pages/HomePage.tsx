import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { SkillBadge } from '../components/members/SkillBadge'
import { SessionCardHero, SessionCardMini } from '../components/sessions/SessionCard'
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

const formatGradient: Record<string, string> = {
  round_robin: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700',
  single_elim: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-600',
  double_elim: 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-600',
  custom: 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900',
}

const statusByStatus: Record<string, string> = {
  ongoing: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700',
  open: '',
  draft: '',
  completed: '',
}

function getTournamentGradient(t: Tournament) {
  return statusByStatus[t.status] || formatGradient[t.format] || formatGradient.custom
}

export function HomePage() {
  const { member: me, isAdmin, signOut } = useAuth()
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
  const [mySessionCheckins, setMySessionCheckins] = useState<Set<string>>(new Set())

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
          .eq('session_date', today)
          .neq('status', 'cancelled')
          .order('start_time'),
        supabase.from('activity_types').select('*').order('display_order'),
        supabase.from('session_checkins').select('session_id'),
        supabase.from('session_checkins').select('session_id').eq('member_id', me.id),
      ])
      if (!mounted) return

      setTournaments((t ?? []) as Tournament[])
      setSurveys((s ?? []) as Survey[])
      void memberCount
      setTodaySessions((todaySess ?? []) as PlaySession[])
      setActivityTypes((at ?? []) as ActivityType[])
      const sessCounts: Record<string, number> = {}
      for (const c of (sessCi ?? []) as Array<Pick<SessionCheckin, 'session_id'>>) {
        sessCounts[c.session_id] = (sessCounts[c.session_id] ?? 0) + 1
      }
      setSessionCheckinCounts(sessCounts)
      setMySessionCheckins(new Set((mySessCi ?? []).map((r) => r.session_id as string)))
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
  }, [me])

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

      {/* Buổi đánh hôm nay — TOP priority */}
      {todaySessions.length > 0 && (
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Buổi đánh hôm nay
            </h2>
            <Link to="/events" className="text-xs text-primary font-semibold">
              Xem tất cả →
            </Link>
          </div>
          <div className="space-y-2">
            {/* Social hero */}
            {todaySessions
              .filter((s) => s.activity_type === 'social')
              .map((s) => (
                <SessionCardHero
                  key={s.id}
                  session={s}
                  activityType={activityTypes.find((a) => a.key === s.activity_type)}
                  checkinCount={sessionCheckinCounts[s.id] ?? 0}
                  hasCheckedIn={mySessionCheckins.has(s.id)}
                />
              ))}
            {/* Training + Ball machine compact 2-col */}
            {todaySessions.filter((s) => s.activity_type !== 'social').length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {todaySessions
                  .filter((s) => s.activity_type !== 'social')
                  .map((s) => (
                    <SessionCardMini
                      key={s.id}
                      session={s}
                      activityType={activityTypes.find((a) => a.key === s.activity_type)}
                      checkinCount={sessionCheckinCounts[s.id] ?? 0}
                      hasCheckedIn={mySessionCheckins.has(s.id)}
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hero Banner: Featured tournaments */}
      {featuredTournaments.length > 0 ? (
        <div className="pt-4">
          <div className="flex items-center justify-between px-4 mb-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Nổi bật
            </h2>
            {featuredTournaments.length > 1 && (
              <span className="text-[11px] text-gray-400">
                Vuốt để xem thêm →
              </span>
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
      ) : (
        <NoTournamentBanner />
      )}

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

function NoTournamentBanner() {
  return (
    <div className="mt-4 mx-4 rounded-2xl bg-gradient-to-br from-primary-50 via-white to-emerald-50 p-5 text-center border border-primary/10">
      <Trophy className="w-10 h-10 text-primary/30 mx-auto mb-2" />
      <p className="text-sm font-semibold text-gray-700">Chưa có giải nào sắp diễn ra</p>
      <p className="text-xs text-gray-500 mt-1">Đợi admin tạo giải mới nhé!</p>
    </div>
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

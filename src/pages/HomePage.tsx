import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LogOut,
  ChevronRight,
  ClipboardList,
  Trophy,
  Users,
  Plus,
  Award,
  Activity as ActivityIcon,
  Calendar,
  MapPin,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { SkillBadge } from '../components/members/SkillBadge'
import { cn } from '../lib/cn'
import type {
  Member,
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

export function HomePage() {
  const { member: me, isAdmin, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [myResponded, setMyResponded] = useState<Set<string>>(new Set())
  const [myRegistrations, setMyRegistrations] = useState<Set<string>>(new Set())
  const [totalMembers, setTotalMembers] = useState(0)
  const [topScorers, setTopScorers] = useState<Scorer[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!me) return
      const [
        { data: t },
        { data: s },
        { data: members, count: memberCount },
        { data: matches },
        { data: regs },
        { data: myResps },
        { data: myRegs },
      ] = await Promise.all([
        supabase
          .from('tournaments')
          .select('*')
          .neq('status', 'completed')
          .order('event_date', { ascending: true, nullsFirst: false })
          .limit(3),
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
          .select('*, tournaments!inner(id, name), members!tournament_registrations_member_id_fkey(full_name)')
          .eq('status', 'confirmed')
          .eq('is_mirror', false)
          .order('registered_at', { ascending: false })
          .limit(5),
        supabase
          .from('survey_responses')
          .select('survey_id')
          .eq('member_id', me.id),
        supabase
          .from('tournament_registrations')
          .select('tournament_id')
          .eq('member_id', me.id)
          .neq('status', 'withdrawn'),
      ])
      if (!mounted) return

      setTournaments((t ?? []) as Tournament[])
      setSurveys((s ?? []) as Survey[])
      setTotalMembers(memberCount ?? 0)
      setMyResponded(new Set((myResps ?? []).map((r) => r.survey_id as string)))
      setMyRegistrations(
        new Set((myRegs ?? []).map((r) => r.tournament_id as string))
      )

      // Top scorers from matches
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

      // Activity feed: merge matches + registrations sort by time
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
  const upcomingTournaments = tournaments.filter((t) => t.status !== 'completed').length

  const now = new Date()

  if (!me) return null

  return (
    <div className="pb-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-50 to-white px-4 pt-6 pb-5">
        <div className="flex items-start gap-3">
          <MemberAvatar member={me} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{greetingByHour(now.getHours())}</p>
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {me.full_name} 👋
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {now.toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
              })}
            </p>
          </div>
          <button
            onClick={signOut}
            className="p-2 -mr-2 rounded-lg text-gray-400 hover:bg-white"
            aria-label="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 -mt-3 grid grid-cols-3 gap-2">
        <StatCard
          to="/surveys"
          icon={ClipboardList}
          label="Khảo sát"
          value={pendingSurveys}
          accent={pendingSurveys > 0 ? 'red' : 'gray'}
          sub={pendingSurveys > 0 ? 'chưa điền' : 'all done'}
        />
        <StatCard
          to="/tournaments"
          icon={Trophy}
          label="Giải đấu"
          value={upcomingTournaments}
          accent="primary"
          sub="sắp tới"
        />
        <StatCard
          to="/members"
          icon={Users}
          label="Thành viên"
          value={totalMembers}
          accent="gray"
          sub="active"
        />
      </div>

      {/* Quick actions (admin only) */}
      {isAdmin && (
        <div className="px-4 mt-4">
          <p className="text-xs text-gray-500 mb-2 font-medium">⚡ Quick actions</p>
          <div className="grid grid-cols-3 gap-2">
            <QuickAction to="/admin" label="+ Khảo sát" icon={ClipboardList} />
            <QuickAction to="/admin" label="+ Giải" icon={Trophy} />
            <QuickAction to="/admin" label="+ Thành viên" icon={Users} />
          </div>
        </div>
      )}

      {/* Tournaments — priority section */}
      <Section title="🏆 Giải sắp tới" href="/tournaments" loading={loading}>
        {tournaments.length === 0 ? (
          <Empty text="Chưa có giải nào sắp diễn ra" />
        ) : (
          tournaments.slice(0, 3).map((t) => (
            <Link
              key={t.id}
              to={`/tournaments/${t.id}`}
              className="bg-white rounded-xl p-3 block hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm text-gray-900 flex-1 min-w-0 truncate">
                  {t.name}
                </h3>
                {myRegistrations.has(t.id) && (
                  <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-700 rounded font-bold">
                    ✓ Đã đăng ký
                  </span>
                )}
                {!myRegistrations.has(t.id) && t.status === 'open' && (
                  <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-bold">
                    Mở đăng ký
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-600 mt-1.5">
                {t.event_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(t.event_date).toLocaleDateString('vi-VN')}
                  </span>
                )}
                {t.venue && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {t.venue}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </Section>

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
                className="bg-white rounded-xl p-3 flex items-center gap-3 hover:bg-gray-50"
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    done ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  )}
                >
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{s.title}</p>
                  <p className="text-xs text-gray-500">
                    {done
                      ? 'Đã điền ✓'
                      : s.closes_at
                      ? `Hạn ${new Date(s.closes_at).toLocaleDateString('vi-VN')}`
                      : 'Đang mở'}
                  </p>
                </div>
                {!done && (
                  <span className="text-xs font-medium text-primary whitespace-nowrap">
                    Điền →
                  </span>
                )}
              </Link>
            )
          })
        )}
      </Section>

      {/* Top scorers */}
      <Section title="🥇 Top scorer" loading={loading}>
        {topScorers.length === 0 ? (
          <Empty text="Chưa có kết quả trận nào" />
        ) : (
          <div className="bg-white rounded-xl divide-y divide-gray-100">
            {topScorers.map((s, i) => (
              <Link
                key={s.member.id}
                to={`/members/${s.member.id}`}
                className="flex items-center gap-3 p-3 hover:bg-gray-50"
              >
                <span
                  className={cn(
                    'w-6 text-center font-bold text-sm',
                    i === 0 && 'text-amber-500',
                    i === 1 && 'text-gray-400',
                    i === 2 && 'text-orange-700'
                  )}
                >
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <MemberAvatar member={s.member} size="sm" />
                <span className="flex-1 text-sm font-medium truncate">
                  {s.member.full_name}
                </span>
                <SkillBadge level={s.member.skill_level} size="sm" />
                <span className="flex items-center gap-1 text-sm font-bold text-primary">
                  <Award className="w-3 h-3" />
                  {s.wins}
                </span>
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
          <div className="bg-white rounded-xl divide-y divide-gray-100">
            {activity.map((a) => (
              <Link key={a.id} to={a.href} className="flex items-start gap-3 p-3 hover:bg-gray-50">
                <ActivityIcon
                  className={cn(
                    'w-4 h-4 mt-0.5 flex-shrink-0',
                    a.type === 'match' ? 'text-amber-500' : 'text-primary'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{a.title}</p>
                  {a.subtitle && (
                    <p className="text-xs text-gray-500 truncate">{a.subtitle}</p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
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
  accent: 'red' | 'primary' | 'gray'
}) {
  const colors = {
    red: 'border-red-200 bg-red-50',
    primary: 'border-primary/20 bg-primary/5',
    gray: 'border-gray-200 bg-white',
  }
  const numColors = {
    red: 'text-red-600',
    primary: 'text-primary',
    gray: 'text-gray-700',
  }
  return (
    <Link
      to={to}
      className={cn(
        'rounded-xl p-3 border block hover:shadow-sm transition-shadow',
        colors[accent]
      )}
    >
      <Icon className={cn('w-4 h-4 mb-1', numColors[accent])} />
      <div className={cn('text-2xl font-bold leading-none', numColors[accent])}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">{label}</div>
      <div className="text-[10px] text-gray-400">{sub}</div>
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
      className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col items-center gap-1 hover:border-primary hover:text-primary text-gray-700"
    >
      <Icon className="w-4 h-4" />
      <span className="text-[11px] font-medium">{label}</span>
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
    <div className="mt-5 px-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700">{title}</h2>
        {href && (
          <Link to={href} className="text-xs text-primary flex items-center gap-0.5">
            Xem tất cả <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl p-4 animate-pulse">
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
  return <div className="bg-white rounded-xl p-4 text-center text-xs text-gray-500">{text}</div>
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày`
  return new Date(iso).toLocaleDateString('vi-VN')
}

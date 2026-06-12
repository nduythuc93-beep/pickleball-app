import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import {
  LogOut,
  ClipboardList,
  Trophy,
  Users,
  Award,
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
import { SessionCardHero, SessionCardMini, type AttendeeLite } from '../components/sessions/SessionCard'
import { AnnouncementBanner } from '../components/announcements/AnnouncementBanner'
import { CommunityLinksRow } from '../components/community/CommunityLinksRow'
import { cn } from '../lib/cn'
import type {
  ActivityType,
  HomeData,
  PlaySession,
  Survey,
  Tournament,
} from '../types/database'

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
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [myResponded, setMyResponded] = useState<Set<string>>(new Set())
  const [myRegistrations, setMyRegistrations] = useState<Set<string>>(new Set())
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
      const { data, error } = await supabase.rpc('get_home_data')
      if (!mounted) return
      if (error || !data) {
        console.error('[home] get_home_data error:', error)
        return
      }
      const d = data as HomeData

      setTournaments(d.tournaments ?? [])
      setSurveys(d.surveys ?? [])
      setTodaySessions(d.sessions ?? [])
      setActivityTypes(d.activity_types ?? [])
      setSessionCheckinCounts(d.session_checkin_counts ?? {})
      setSessionAttendees((d.session_attendees ?? {}) as Record<string, AttendeeLite[]>)
      setSessionWalkInCounts(d.session_walk_in_counts ?? {})
      setHostCoachMembers((d.host_coach_members ?? []) as AttendeeLite[])
      setMySessionCheckins(new Set(d.my_session_checkin_ids ?? []))
      setMyOptOuts(new Set(d.my_opt_out_session_ids ?? []))
      setMyResponded(new Set(d.my_responded_survey_ids ?? []))
      setMyRegistrations(new Set(d.my_registered_tournament_ids ?? []))
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

      {/* Kênh cộng đồng — admin configures, only renders if any active */}
      <div className="px-4 mt-3">
        <CommunityLinksRow variant="prominent" />
      </div>

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


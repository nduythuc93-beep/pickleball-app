import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { SessionCard, SessionCardHero, SessionCardMini, type AttendeeLite } from '../components/sessions/SessionCard'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/cn'
import { ACTIVITY_STYLE, formatDateFull } from '../lib/sessions'
import type {
  ActivityType,
  ActivityTypeKey,
  PlaySession,
  SessionCheckin,
} from '../types/database'

type Filter = 'all' | ActivityTypeKey
type TimeTab = 'upcoming' | 'history'

export function SessionsPage() {
  const { member: me, user } = useAuth()
  const [sessions, setSessions] = useState<PlaySession[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({})
  const [walkInCounts, setWalkInCounts] = useState<Record<string, number>>({})
  const [sessionAttendees, setSessionAttendees] = useState<Record<string, AttendeeLite[]>>({})
  const [hostCoachMembers, setHostCoachMembers] = useState<AttendeeLite[]>([])
  const [myCheckins, setMyCheckins] = useState<Set<string>>(new Set())
  const [myOptOuts, setMyOptOuts] = useState<Set<string>>(new Set())
  const [quickCheckinId, setQuickCheckinId] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [timeTab, setTimeTab] = useState<TimeTab>('upcoming')

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!me) return
      // Lấy sessions từ 14 ngày trước đến 30 ngày tới (cover cả upcoming + history)
      const now = new Date()
      const from = new Date(now.getTime() - 14 * 86400000)
      const to = new Date(now.getTime() + 30 * 86400000)

      const [
        { data: s },
        { data: at },
        { data: ci },
        { data: mc },
        { data: wi },
        { data: hostsCoaches },
        { data: optOuts },
      ] = await Promise.all([
        supabase
          .from('play_sessions')
          .select('*')
          .gte('session_date', from.toISOString().slice(0, 10))
          .lte('session_date', to.toISOString().slice(0, 10))
          .neq('status', 'cancelled')
          .order('session_date', { ascending: true })
          .order('start_time', { ascending: true }),
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

      setSessions((s ?? []) as PlaySession[])
      setActivityTypes((at ?? []) as ActivityType[])

      type CiRow = Pick<SessionCheckin, 'session_id'> & {
        members: AttendeeLite | AttendeeLite[] | null
      }
      const counts: Record<string, number> = {}
      const attendees: Record<string, AttendeeLite[]> = {}
      for (const c of (ci ?? []) as unknown as CiRow[]) {
        counts[c.session_id] = (counts[c.session_id] ?? 0) + 1
        const m = Array.isArray(c.members) ? c.members[0] : c.members
        if (m) {
          ;(attendees[c.session_id] ??= []).push(m)
        }
      }
      setCheckinCounts(counts)
      setSessionAttendees(attendees)

      const wiCounts: Record<string, number> = {}
      for (const w of (wi ?? []) as Array<{ session_id: string | null }>) {
        if (!w.session_id) continue
        wiCounts[w.session_id] = (wiCounts[w.session_id] ?? 0) + 1
      }
      setWalkInCounts(wiCounts)

      setHostCoachMembers((hostsCoaches ?? []) as AttendeeLite[])
      setMyCheckins(new Set((mc ?? []).map((r) => r.session_id as string)))
      setMyOptOuts(new Set((optOuts ?? []).map((r) => r.session_id as string)))
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [me, reloadTick])

  // Auto-check-in Host vào tất cả Social sessions (mặc định luôn có mặt)
  // EXCEPTION: Host đã chủ động huỷ check-in → tôn trọng opt-out
  useEffect(() => {
    if (!me || !me.is_host) return
    if (sessions.length === 0) return

    const nowMs = Date.now()
    const candidates = sessions.filter(
      (s) =>
        s.activity_type === 'social' &&
        s.status !== 'cancelled' &&
        new Date(`${s.session_date}T${s.end_time}`).getTime() > nowMs &&
        !myCheckins.has(s.id) &&
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
      if (!error) setReloadTick((t) => t + 1)
    }
    autoCheckin()
    return () => {
      cancelled = true
    }
  }, [me, sessions, myCheckins, myOptOuts, user])

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

  const atByKey = useMemo(() => {
    const m = new Map<string, ActivityType>()
    for (const a of activityTypes) m.set(a.key, a)
    return m
  }, [activityTypes])

  const filtered = useMemo(() => {
    const nowMs = Date.now()
    return sessions.filter((s) => {
      if (filter !== 'all' && s.activity_type !== filter) return false
      const endMs = new Date(`${s.session_date}T${s.end_time}`).getTime()
      const isUpcoming = endMs > nowMs
      return timeTab === 'upcoming' ? isUpcoming : !isUpcoming
    })
  }, [sessions, filter, timeTab])

  // Group by date — history sort DESC để recent đầu, upcoming sort ASC
  const groupedByDate = useMemo(() => {
    const m = new Map<string, PlaySession[]>()
    for (const s of filtered) {
      const arr = m.get(s.session_date) ?? []
      arr.push(s)
      m.set(s.session_date, arr)
    }
    const entries = Array.from(m.entries())
    return timeTab === 'history' ? entries.reverse() : entries
  }, [filtered, timeTab])

  const upcomingCount = useMemo(() => {
    const nowMs = Date.now()
    return sessions.filter(
      (s) => new Date(`${s.session_date}T${s.end_time}`).getTime() > nowMs
    ).length
  }, [sessions])

  const historyCount = useMemo(() => {
    const nowMs = Date.now()
    return sessions.filter(
      (s) => new Date(`${s.session_date}T${s.end_time}`).getTime() <= nowMs
    ).length
  }, [sessions])

  return (
    <div>
      {/* STICKY HEADER: time toggle + filter chips, sticky bên dưới EventsPage segment */}
      <div className="sticky top-[114px] z-10 bg-white border-b border-gray-100">
      <div className="px-4 pt-3 pb-2">
        <div className="bg-gray-100 p-0.5 rounded-lg grid grid-cols-2 gap-0.5">
          <button
            onClick={() => setTimeTab('upcoming')}
            className={cn(
              'py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1',
              timeTab === 'upcoming'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            )}
          >
            <Calendar className="w-3 h-3" />
            Sắp tới
            {upcomingCount > 0 && (
              <span
                className={cn(
                  'ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  timeTab === 'upcoming' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                )}
              >
                {upcomingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTimeTab('history')}
            className={cn(
              'py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1',
              timeTab === 'history'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            )}
          >
            <History className="w-3 h-3" />
            Lịch sử 14d
            {historyCount > 0 && (
              <span
                className={cn(
                  'ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  timeTab === 'history' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
                )}
              >
                {historyCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter chips — compact horizontal scroll */}
      <div className="px-4 pb-3">
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors',
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            )}
          >
            Tất cả
          </button>
          {activityTypes.map((at) => {
            const style = ACTIVITY_STYLE[at.key]
            return (
              <button
                key={at.key}
                onClick={() => setFilter(at.key)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1',
                  filter === at.key
                    ? style.chip + ' shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                )}
              >
                <span className="text-sm">{at.icon}</span>
                {at.label.replace('Đánh ', '').replace('Máy bắn ', 'Máy ')}
              </button>
            )
          })}
        </div>
      </div>
      </div>

      <div className="p-4 space-y-5">
        {loading && (
          <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>
        )}

        {!loading && groupedByDate.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            {timeTab === 'upcoming' ? (
              <>
                <Calendar className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                Chưa có buổi đánh nào sắp tới.
                <br />
                <span className="text-xs">Đợi admin sinh lịch hoặc auto-gen 8h sáng.</span>
              </>
            ) : (
              <>
                <History className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                Chưa có lịch sử trong 14 ngày qua.
              </>
            )}
          </div>
        )}

        {!loading &&
          groupedByDate.map(([date, list]) => {
            const isToday = date === new Date().toISOString().slice(0, 10)
            const isPast = date < new Date().toISOString().slice(0, 10)
            // Tách Social ra trước (hero), còn lại render mini
            const socialSessions = list.filter((s) => s.activity_type === 'social')
            const otherSessions = list.filter((s) => s.activity_type !== 'social')

            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h2
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      isToday ? 'text-primary' : isPast ? 'text-gray-400' : 'text-gray-600'
                    )}
                  >
                    {isToday && '★ '}
                    {formatDateFull(date)}
                  </h2>
                </div>

                {/* Hero: Social */}
                {socialSessions.map((s) => (
                  <SessionCardHero
                    key={s.id}
                    session={s}
                    activityType={atByKey.get(s.activity_type)}
                    checkinCount={checkinCounts[s.id] ?? 0}
                    walkInCount={walkInCounts[s.id] ?? 0}
                    hasCheckedIn={myCheckins.has(s.id)}
                    attendees={sessionAttendees[s.id] ?? []}
                    defaultAttendees={hostCoachMembers}
                    onQuickCheckin={() => handleQuickCheckin(s)}
                    quickCheckinLoading={quickCheckinId === s.id}
                  />
                ))}

                {/* Mini grid: Training + Ball machine 2-col */}
                {otherSessions.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {otherSessions.map((s) => (
                      <SessionCardMini
                        key={s.id}
                        session={s}
                        activityType={atByKey.get(s.activity_type)}
                        checkinCount={checkinCounts[s.id] ?? 0}
                        walkInCount={walkInCounts[s.id] ?? 0}
                        hasCheckedIn={myCheckins.has(s.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Fallback: nếu chỉ có Social hoặc cấu trúc khác — em vẫn handle */}
                {socialSessions.length === 0 &&
                  otherSessions.length === 0 &&
                  list.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      activityType={atByKey.get(s.activity_type)}
                      checkinCount={checkinCounts[s.id] ?? 0}
                      walkInCount={walkInCounts[s.id] ?? 0}
                      hasCheckedIn={myCheckins.has(s.id)}
                    />
                  ))}
              </div>
            )
          })}
      </div>
    </div>
  )
}

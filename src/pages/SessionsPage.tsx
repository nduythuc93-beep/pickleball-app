import { useEffect, useMemo, useState } from 'react'
import { Calendar } from 'lucide-react'
import { SessionCard } from '../components/sessions/SessionCard'
import { supabase } from '../lib/supabase'
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

export function SessionsPage() {
  const { member: me } = useAuth()
  const [sessions, setSessions] = useState<PlaySession[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({})
  const [myCheckins, setMyCheckins] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!me) return
      // Lấy sessions từ 7 ngày trước đến 14 ngày tới
      const now = new Date()
      const from = new Date(now.getTime() - 7 * 86400000)
      const to = new Date(now.getTime() + 14 * 86400000)

      const [{ data: s }, { data: at }, { data: ci }, { data: mc }] = await Promise.all([
        supabase
          .from('play_sessions')
          .select('*')
          .gte('session_date', from.toISOString().slice(0, 10))
          .lte('session_date', to.toISOString().slice(0, 10))
          .neq('status', 'cancelled')
          .order('session_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase.from('activity_types').select('*').order('display_order'),
        supabase.from('session_checkins').select('session_id'),
        supabase.from('session_checkins').select('session_id').eq('member_id', me.id),
      ])
      if (!mounted) return

      setSessions((s ?? []) as PlaySession[])
      setActivityTypes((at ?? []) as ActivityType[])

      const counts: Record<string, number> = {}
      for (const c of (ci ?? []) as Array<Pick<SessionCheckin, 'session_id'>>) {
        counts[c.session_id] = (counts[c.session_id] ?? 0) + 1
      }
      setCheckinCounts(counts)
      setMyCheckins(new Set((mc ?? []).map((r) => r.session_id as string)))
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [me])

  const atByKey = useMemo(() => {
    const m = new Map<string, ActivityType>()
    for (const a of activityTypes) m.set(a.key, a)
    return m
  }, [activityTypes])

  const filtered = useMemo(() => {
    return sessions.filter((s) => filter === 'all' || s.activity_type === filter)
  }, [sessions, filter])

  // Group by date
  const groupedByDate = useMemo(() => {
    const m = new Map<string, PlaySession[]>()
    for (const s of filtered) {
      const arr = m.get(s.session_date) ?? []
      arr.push(s)
      m.set(s.session_date, arr)
    }
    return Array.from(m.entries())
  }, [filtered])

  return (
    <div>
      {/* Filter chips */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border',
              filter === 'all'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200'
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
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border flex items-center gap-1',
                  filter === at.key ? style.chip + ' shadow-sm' : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                <span>{at.icon}</span>
                {at.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {loading && (
          <div className="text-center text-gray-500 text-sm py-8">Đang tải...</div>
        )}

        {!loading && groupedByDate.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">
            <Calendar className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            Chưa có buổi đánh nào trong 2 tuần tới.
            <br />
            <span className="text-xs">Đợi admin sinh lịch hoặc lịch tự sinh tuần tới.</span>
          </div>
        )}

        {!loading &&
          groupedByDate.map(([date, list]) => {
            const isToday = date === new Date().toISOString().slice(0, 10)
            const isPast = date < new Date().toISOString().slice(0, 10)
            return (
              <div key={date} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <h2 className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    isToday ? 'text-primary' : isPast ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {isToday && '★ '}{formatDateFull(date)}
                  </h2>
                </div>
                {list.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    activityType={atByKey.get(s.activity_type)}
                    checkinCount={checkinCounts[s.id] ?? 0}
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Sparkles, Trash2, Pencil, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { SessionCard } from './SessionCard'
import { SessionFormModal } from './SessionFormModal'
import {
  ACTIVITY_STYLE,
  DAY_LABELS_LONG,
  formatTime,
  formatVnd,
  isoDowToJs,
} from '../../lib/sessions'
import { cn } from '../../lib/cn'
import type {
  ActivityType,
  PlaySession,
  SessionCheckin,
  SessionSchedule,
} from '../../types/database'

export function AdminSessionsTab() {
  const { user } = useAuth()
  const [schedules, setSchedules] = useState<SessionSchedule[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [sessions, setSessions] = useState<PlaySession[]>([])
  const [checkinCounts, setCheckinCounts] = useState<Record<string, number>>({})
  const [walkInCounts, setWalkInCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PlaySession | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: sch }, { data: at }, { data: s }, { data: ci }, { data: wi }] =
      await Promise.all([
        supabase
          .from('session_schedules')
          .select('*')
          .order('day_of_week')
          .order('start_time'),
        supabase.from('activity_types').select('*').order('display_order'),
        supabase
          .from('play_sessions')
          .select('*')
          .gte('session_date', today)
          .order('session_date')
          .order('start_time'),
        supabase.from('session_checkins').select('session_id'),
        supabase.from('walk_in_checkins').select('session_id'),
      ])
    setSchedules((sch ?? []) as SessionSchedule[])
    setActivityTypes((at ?? []) as ActivityType[])
    setSessions((s ?? []) as PlaySession[])
    const counts: Record<string, number> = {}
    for (const c of (ci ?? []) as Array<Pick<SessionCheckin, 'session_id'>>) {
      counts[c.session_id] = (counts[c.session_id] ?? 0) + 1
    }
    setCheckinCounts(counts)
    const wiCounts: Record<string, number> = {}
    for (const w of (wi ?? []) as Array<{ session_id: string | null }>) {
      if (!w.session_id) continue
      wiCounts[w.session_id] = (wiCounts[w.session_id] ?? 0) + 1
    }
    setWalkInCounts(wiCounts)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const atByKey = useMemo(() => {
    const m = new Map<string, ActivityType>()
    for (const a of activityTypes) m.set(a.key, a)
    return m
  }, [activityTypes])

  async function generateNextWeek() {
    setGenerating(true)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startStr = today.toISOString().slice(0, 10)
    const endStr = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10)

    // Lấy sessions đã có trong range để dedup
    const { data: existing, error: fetchErr } = await supabase
      .from('play_sessions')
      .select('schedule_id, session_date')
      .gte('session_date', startStr)
      .lte('session_date', endStr)
      .not('schedule_id', 'is', null)
    if (fetchErr) {
      setGenerating(false)
      toast.error(friendlyError(fetchErr))
      return
    }
    const existingKeys = new Set(
      (existing ?? []).map((s) => `${s.schedule_id}:${s.session_date}`)
    )

    const created: Array<Record<string, unknown>> = []
    for (let i = 0; i <= 14; i++) {
      const date = new Date(today.getTime() + i * 86400000)
      const isoDow = date.getDay() === 0 ? 7 : date.getDay()
      const dateStr = date.toISOString().slice(0, 10)
      const matches = schedules.filter((s) => s.day_of_week === isoDow && s.is_active)
      for (const sch of matches) {
        const key = `${sch.id}:${dateStr}`
        if (existingKeys.has(key)) continue // skip duplicate
        const at = atByKey.get(sch.activity_type)
        created.push({
          activity_type: sch.activity_type,
          session_date: dateStr,
          start_time: sch.start_time,
          end_time: sch.end_time,
          venue: sch.venue,
          max_attendees: sch.max_attendees,
          price_vnd: sch.price_vnd ?? at?.default_price_vnd ?? 0,
          points_award: sch.points_award ?? at?.default_points ?? 0,
          instructor_name: sch.instructor_name,
          schedule_id: sch.id,
          created_by: user?.id ?? null,
        })
      }
    }

    if (created.length === 0) {
      setGenerating(false)
      toast.success('Tất cả session đã có sẵn — không cần tạo thêm')
      return
    }

    const { error } = await supabase.from('play_sessions').insert(created)
    setGenerating(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(`Đã sinh ${created.length} session mới`)
    load()
  }

  async function deleteSession(s: PlaySession) {
    if (!confirm('Xoá buổi này? Tất cả check-in sẽ bị xoá theo.')) return
    const { error } = await supabase.from('play_sessions').delete().eq('id', s.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã xoá')
    load()
  }

  // Group schedules by day
  const schedulesByDay = useMemo(() => {
    const m = new Map<number, SessionSchedule[]>()
    for (const s of schedules) {
      const arr = m.get(s.day_of_week) ?? []
      arr.push(s)
      m.set(s.day_of_week, arr)
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [schedules])

  return (
    <div>
      <div className="p-4 bg-white border-b border-gray-100 space-y-2">
        <Button onClick={generateNextWeek} loading={generating} className="w-full">
          <Sparkles className="w-4 h-4 mr-1" />
          Sinh session 14 ngày tới (auto)
        </Button>
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          variant="secondary"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-1" />
          Tạo session thủ công
        </Button>
        <p className="text-xs text-gray-500 text-center">
          Auto: theo lịch định kỳ T2/T4/T6 · Thủ công: tạo buổi đặc biệt bất kỳ ngày
        </p>
      </div>

      {/* Lịch định kỳ */}
      <div className="p-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">📅 Lịch định kỳ</h2>
        {loading && <div className="text-center text-gray-500 text-sm py-4">Đang tải...</div>}
        {!loading && schedules.length === 0 && (
          <div className="bg-white rounded-xl p-4 text-center text-sm text-gray-500">
            Chưa có lịch nào. Chạy SQL seed.
          </div>
        )}
        <div className="space-y-3">
          {schedulesByDay.map(([dow, list]) => (
            <div key={dow} className="bg-white rounded-xl p-3">
              <h3 className="text-xs font-bold text-gray-700 mb-2">
                {DAY_LABELS_LONG[isoDowToJs(dow)]}
              </h3>
              <div className="space-y-1.5">
                {list.map((s) => {
                  const at = atByKey.get(s.activity_type)
                  const style = ACTIVITY_STYLE[s.activity_type]
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs',
                        s.is_active ? style.chip : 'bg-gray-50 text-gray-400 border-gray-200'
                      )}
                    >
                      <span className="text-base">{at?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">
                          {at?.label}{!s.is_active && ' (tắt)'}
                        </div>
                        <div className="text-[10px] opacity-75">
                          {formatTime(s.start_time)}-{formatTime(s.end_time)} ·{' '}
                          {formatVnd(s.price_vnd ?? at?.default_price_vnd ?? 0)} ·{' '}
                          +{s.points_award ?? at?.default_points ?? 0}đ ·{' '}
                          max {s.max_attendees}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sessions sắp tới */}
      <div className="p-4">
        <h2 className="text-sm font-bold text-gray-700 mb-2">
          🎯 Sessions sắp tới ({sessions.length})
        </h2>
        {loading && <div className="text-center text-gray-500 text-sm py-4">Đang tải...</div>}
        {!loading && sessions.length === 0 && (
          <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
            <Calendar className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            Chưa có session nào. Bấm "Sinh session" ở trên.
          </div>
        )}
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="space-y-1">
              <SessionCard
                session={s}
                activityType={atByKey.get(s.activity_type)}
                checkinCount={checkinCounts[s.id] ?? 0}
                walkInCount={walkInCounts[s.id] ?? 0}
              />
              <div className="flex gap-2 px-1">
                <button
                  onClick={() => {
                    setEditing(s)
                    setFormOpen(true)
                  }}
                  className="flex-1 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Sửa
                </button>
                <button
                  onClick={() => deleteSession(s)}
                  className="py-1.5 px-3 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SessionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        session={editing}
        activityTypes={activityTypes}
        onSaved={load}
      />
    </div>
  )
}

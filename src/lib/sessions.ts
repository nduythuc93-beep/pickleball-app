import type { PlaySession, ActivityTypeKey } from '../types/database'

export const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const DAY_LABELS_LONG = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

/** Convert ISO day_of_week (1=Mon, 7=Sun) → JS getDay() index (0=Sun, 6=Sat) */
export function isoDowToJs(iso: number): number {
  return iso === 7 ? 0 : iso
}

/** Convert JS getDay() (0=Sun, 6=Sat) → ISO (1=Mon, 7=Sun) */
export function jsDowToIso(js: number): number {
  return js === 0 ? 7 : js
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ'
}

export function formatTime(t: string): string {
  // 'HH:MM:SS' or 'HH:MM' → 'HH:MM'
  return t.slice(0, 5)
}

export function formatDate(dateIso: string): string {
  return new Date(dateIso + 'T00:00:00').toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

export function formatDateFull(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00')
  return `${DAY_LABELS_LONG[d.getDay()]}, ${d.toLocaleDateString('vi-VN')}`
}

/**
 * Check-in window:
 * - Mở: 7 NGÀY trước session.start_time
 * - Đóng: 1h sau session.end_time
 */
export function getCheckinWindow(session: PlaySession): {
  canCheckIn: boolean
  reason?: string
  status: 'before' | 'open' | 'after'
} {
  const now = new Date()
  const sessionDate = session.session_date
  const start = new Date(`${sessionDate}T${session.start_time}`)
  const end = new Date(`${sessionDate}T${session.end_time}`)
  const openAt = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000) // -7 days
  const closeAt = new Date(end.getTime() + 60 * 60 * 1000) // +1h

  if (now < openAt) {
    return {
      canCheckIn: false,
      reason: `Check-in mở từ ${openAt.toLocaleDateString('vi-VN')}`,
      status: 'before',
    }
  }
  if (now > closeAt) {
    return { canCheckIn: false, reason: 'Check-in đã đóng', status: 'after' }
  }
  return { canCheckIn: true, status: 'open' }
}

/**
 * Cancel window:
 * - Free cancel: now < session.start_time - 3h
 * - Penalty cancel (-5đ): session.start - 3h < now < session.end
 * - No cancel: now > session.end
 */
export function getCancelWindow(session: PlaySession): {
  canCancel: boolean
  withPenalty: boolean
  reason?: string
} {
  const now = new Date()
  const start = new Date(`${session.session_date}T${session.start_time}`)
  const end = new Date(`${session.session_date}T${session.end_time}`)
  const penaltyThreshold = new Date(start.getTime() - 3 * 60 * 60 * 1000)

  if (now > end) {
    return { canCancel: false, withPenalty: false, reason: 'Buổi đã qua, không huỷ được' }
  }
  if (now > penaltyThreshold) {
    return {
      canCancel: true,
      withPenalty: true,
      reason: 'Huỷ sát giờ — sẽ bị trừ 5 điểm (nếu có)',
    }
  }
  return { canCancel: true, withPenalty: false }
}

export const ACTIVITY_STYLE: Record<
  ActivityTypeKey,
  { gradient: string; chip: string; iconBg: string; iconText: string }
> = {
  social: {
    gradient: 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-700',
  },
  training: {
    gradient: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-600',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
  },
  ball_machine: {
    gradient: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-700',
  },
}

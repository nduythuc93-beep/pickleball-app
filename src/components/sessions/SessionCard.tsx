import { Link } from 'react-router-dom'
import { Calendar, Clock, MapPin, Users, CheckCircle2, ArrowRight, Trophy } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ACTIVITY_STYLE, formatDateShort, formatTime, formatVnd } from '../../lib/sessions'
import type { ActivityType, PlaySession } from '../../types/database'

type Props = {
  session: PlaySession
  activityType?: ActivityType
  checkinCount?: number
  hasCheckedIn?: boolean
}

export function SessionCard({ session, activityType, checkinCount, hasCheckedIn }: Props) {
  const style = ACTIVITY_STYLE[session.activity_type]
  const isCancelled = session.status === 'cancelled'
  const isCompleted = session.status === 'completed'

  return (
    <Link
      to={`/sessions/${session.id}`}
      className={cn(
        'bg-white rounded-2xl p-3 block hover:bg-gray-50 transition-colors shadow-sm overflow-hidden relative',
        isCancelled && 'opacity-50'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0',
            style.iconBg
          )}
        >
          {activityType?.icon ?? '🏓'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-gray-900 truncate">
              {activityType?.label ?? session.activity_type}
            </h3>
            {hasCheckedIn && (
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> Đã ĐK
              </span>
            )}
            {isCancelled && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold">
                ĐÃ HUỶ
              </span>
            )}
            {isCompleted && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-bold">
                ĐÃ XONG
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
            <span className="flex items-center gap-1 font-semibold text-gray-700">
              <Calendar className="w-3 h-3" />
              {formatDateShort(session.session_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(session.start_time)}-{formatTime(session.end_time)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {session.venue}
            </span>
            {typeof checkinCount === 'number' && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {checkinCount}/{session.max_attendees}
              </span>
            )}
          </div>
          {session.instructor_name && (
            <p className="text-xs text-gray-500 mt-1">HLV: {session.instructor_name}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-gray-900">{formatVnd(session.price_vnd)}</div>
          {session.points_award > 0 && (
            <div className="text-[10px] text-primary font-semibold">+{session.points_award}đ</div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function SessionCardCompact({
  session,
  activityType,
}: {
  session: PlaySession
  activityType?: ActivityType
}) {
  const style = ACTIVITY_STYLE[session.activity_type]
  return (
    <Link
      to={`/sessions/${session.id}`}
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs',
        style.chip
      )}
    >
      <span className="text-base">{activityType?.icon ?? '🏓'}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{activityType?.label ?? session.activity_type}</div>
        <div className="text-[10px] opacity-75">
          {formatTime(session.start_time)}-{formatTime(session.end_time)} · {formatVnd(session.price_vnd)}
        </div>
      </div>
      <Calendar className="w-3 h-3 opacity-50" />
    </Link>
  )
}

/**
 * Hero card cho Social — nổi bật, full-width gradient.
 */
export function SessionCardHero({
  session,
  activityType,
  checkinCount,
  hasCheckedIn,
}: {
  session: PlaySession
  activityType?: ActivityType
  checkinCount?: number
  hasCheckedIn?: boolean
}) {
  const style = ACTIVITY_STYLE[session.activity_type]
  const isCancelled = session.status === 'cancelled'
  const isCompleted = session.status === 'completed'

  return (
    <Link
      to={`/sessions/${session.id}`}
      className={cn(
        'relative block rounded-2xl overflow-hidden shadow-lg text-white',
        style.gradient,
        isCancelled && 'opacity-50'
      )}
    >
      {/* Decorative paddle pattern */}
      <Trophy className="absolute -right-8 -top-8 w-44 h-44 opacity-10 rotate-12" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{activityType?.icon ?? '🏓'}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur px-2 py-0.5 rounded-full">
                ★ Hoạt động chính
              </span>
            </div>
            <h3 className="text-xl font-bold leading-tight drop-shadow">
              {activityType?.label ?? session.activity_type}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold drop-shadow">{formatVnd(session.price_vnd)}</div>
            {session.points_award > 0 && (
              <div className="text-xs font-semibold opacity-95">+{session.points_award} điểm</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs mb-1 opacity-95">
          <span className="flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-0.5 rounded-full font-semibold">
            <Calendar className="w-3 h-3" />
            {formatDateShort(session.session_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(session.start_time)}-{formatTime(session.end_time)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs mb-3 opacity-90">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {session.venue}
          </span>
          {typeof checkinCount === 'number' && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {checkinCount}/{session.max_attendees}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          {hasCheckedIn ? (
            <span className="bg-white/25 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-white/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đã check-in
            </span>
          ) : isCancelled ? (
            <span className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold">
              ĐÃ HUỶ
            </span>
          ) : isCompleted ? (
            <span className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold">
              ĐÃ XONG
            </span>
          ) : (
            <span className="bg-white text-gray-900 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-md">
              Check-in
              <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/**
 * Mini card cho Training + Ball machine — compact 2-col grid.
 */
export function SessionCardMini({
  session,
  activityType,
  checkinCount,
  hasCheckedIn,
}: {
  session: PlaySession
  activityType?: ActivityType
  checkinCount?: number
  hasCheckedIn?: boolean
}) {
  const style = ACTIVITY_STYLE[session.activity_type]
  const isCancelled = session.status === 'cancelled'

  return (
    <Link
      to={`/sessions/${session.id}`}
      className={cn(
        'bg-white rounded-xl px-2.5 py-2 block hover:bg-gray-50 transition-colors shadow-sm border-l-4',
        isCancelled && 'opacity-50',
        session.activity_type === 'training' ? 'border-amber-500' : 'border-blue-500'
      )}
    >
      {/* Row 1: icon + tên + +điểm */}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-sm flex-shrink-0',
            style.iconBg
          )}
        >
          {activityType?.icon ?? '🏓'}
        </div>
        <h3 className="font-semibold text-xs text-gray-900 truncate flex-1">
          {activityType?.label ?? session.activity_type}
        </h3>
        {session.points_award > 0 && (
          <span className="text-[10px] font-bold text-primary">+{session.points_award}đ</span>
        )}
      </div>

      {/* Row 2: date + time + count (1 dòng) */}
      <div className="flex items-center gap-1 text-[11px] text-gray-600 mt-1 truncate">
        <span className="font-semibold text-gray-700 truncate">
          {formatDateShort(session.session_date)}
        </span>
        <span className="text-gray-400">·</span>
        <span>
          {formatTime(session.start_time)}-{formatTime(session.end_time)}
        </span>
        {typeof checkinCount === 'number' && (
          <>
            <span className="text-gray-400">·</span>
            <span>
              {checkinCount}/{session.max_attendees}
            </span>
          </>
        )}
        {hasCheckedIn && (
          <CheckCircle2 className="w-3 h-3 text-primary ml-auto flex-shrink-0" />
        )}
      </div>

      {/* Row 3 (optional): HLV name nếu có */}
      {session.instructor_name && (
        <div className="text-[10px] text-amber-700 font-medium truncate mt-0.5">
          HLV: {session.instructor_name}
        </div>
      )}
    </Link>
  )
}

import { Link } from 'react-router-dom'
import { Calendar, Clock, MapPin, Users, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ACTIVITY_STYLE, formatTime, formatVnd } from '../../lib/sessions'
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

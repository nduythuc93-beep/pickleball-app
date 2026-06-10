import { ArrowLeft, Clock, MapPin, Users } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ACTIVITY_STYLE, formatDateFull, formatTime } from '../../lib/sessions'
import type { ActivityType, PlaySession } from '../../types/database'

type Props = {
  session: PlaySession
  activityType: ActivityType | null
  totalAttendees: number
  onBack: () => void
}

/**
 * Green gradient hero for SessionDetailPage — activity icon, title,
 * date, time, venue, attendee count, back button.
 */
export function SessionHero({ session, activityType, totalAttendees, onBack }: Props) {
  const style = ACTIVITY_STYLE[session.activity_type]
  return (
    <div className={cn('relative text-white overflow-hidden', style.gradient)}>
      <button
        onClick={onBack}
        className="absolute top-3 left-3 z-10 p-2 rounded-lg bg-white/20 backdrop-blur"
        aria-label="Quay lại"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      <div className="relative p-5 pt-14">
        <div className="text-4xl mb-1">{activityType?.icon ?? '🏓'}</div>
        <h1 className="text-2xl font-bold">{activityType?.label}</h1>
        <p className="text-sm opacity-90 mt-1">{formatDateFull(session.session_date)}</p>
        <div className="mt-3 flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(session.start_time)}-{formatTime(session.end_time)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {session.venue}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {totalAttendees}/{session.max_attendees}
          </span>
        </div>
      </div>
    </div>
  )
}

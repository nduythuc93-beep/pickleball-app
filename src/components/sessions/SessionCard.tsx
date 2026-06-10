import { Link } from 'react-router-dom'
import { Calendar, Clock, MapPin, Users, CheckCircle2, ArrowRight, Trophy } from 'lucide-react'
import { cn } from '../../lib/cn'
import { ACTIVITY_STYLE, formatDateShort, formatTime, formatVnd } from '../../lib/sessions'
import { MemberAvatar } from '../members/MemberAvatar'
import type { ActivityType, Member, PlaySession } from '../../types/database'

export type AttendeeLite = Pick<
  Member,
  'id' | 'full_name' | 'avatar_url' | 'avatar_updated_at' | 'is_host' | 'is_coach'
>

type Props = {
  session: PlaySession
  activityType?: ActivityType
  checkinCount?: number
  walkInCount?: number
  hasCheckedIn?: boolean
}

export function SessionCard({
  session,
  activityType,
  checkinCount,
  walkInCount,
  hasCheckedIn,
}: Props) {
  const total =
    typeof checkinCount === 'number' ? checkinCount + (walkInCount ?? 0) : undefined
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
            {typeof total === 'number' && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {total}/{session.max_attendees}
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
  walkInCount,
  hasCheckedIn,
  attendees = [],
  defaultAttendees = [],
}: {
  session: PlaySession
  activityType?: ActivityType
  checkinCount?: number
  walkInCount?: number
  hasCheckedIn?: boolean
  /** Members who have actually checked in (with avatars) */
  attendees?: AttendeeLite[]
  /** Host/Coach who haven't checked in yet but presumed to attend */
  defaultAttendees?: AttendeeLite[]
}) {
  const style = ACTIVITY_STYLE[session.activity_type]
  const isCancelled = session.status === 'cancelled'
  const isCompleted = session.status === 'completed'

  const total =
    typeof checkinCount === 'number' ? checkinCount + (walkInCount ?? 0) : 0
  const fillPct = session.max_attendees > 0
    ? Math.min(100, (total / session.max_attendees) * 100)
    : 0

  // Build avatar list:
  // - actual attendees first (full color, solid ring)
  // - then host/coach who HAVEN'T checked in (grayscale, dashed ring, "mặc định")
  const checkedInIds = new Set(attendees.map((a) => a.id))
  const pendingDefaults = defaultAttendees.filter((a) => !checkedInIds.has(a.id))
  const stack: Array<{ member: AttendeeLite; isCheckedIn: boolean }> = [
    ...attendees.map((a) => ({ member: a, isCheckedIn: true })),
    ...pendingDefaults.map((a) => ({ member: a, isCheckedIn: false })),
  ]
  const visibleAvatars = stack.slice(0, 6)
  const extraAvatarCount = Math.max(0, stack.length - visibleAvatars.length)

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
        {/* Header — title + price stacked compactly */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <span className="inline-block text-[9px] font-bold uppercase tracking-widest bg-white/20 backdrop-blur px-2 py-0.5 rounded-full mb-1.5">
              ★ Hoạt động chính
            </span>
            <h3 className="text-2xl font-bold leading-tight drop-shadow">
              {activityType?.label ?? session.activity_type}
            </h3>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-base font-bold drop-shadow leading-none">
              {formatVnd(session.price_vnd)}
            </div>
            {session.points_award > 0 && (
              <div className="text-[11px] font-semibold opacity-90 mt-0.5">
                +{session.points_award}đ
              </div>
            )}
          </div>
        </div>

        {/* Single-line meta: date · time · venue · count */}
        <div className="flex items-center gap-x-2 gap-y-0.5 text-xs opacity-95 mb-2.5 flex-wrap">
          <span className="font-semibold">{formatDateShort(session.session_date)}</span>
          <span className="opacity-60">·</span>
          <span>
            {formatTime(session.start_time)}-{formatTime(session.end_time)}
          </span>
          <span className="opacity-60">·</span>
          <span className="flex items-center gap-0.5">
            <MapPin className="w-3 h-3" />
            {session.venue}
          </span>
          {typeof checkinCount === 'number' && (
            <>
              <span className="opacity-60">·</span>
              <span className="flex items-center gap-0.5 font-semibold">
                <Users className="w-3 h-3" />
                {total}/{session.max_attendees}
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        {typeof checkinCount === 'number' && session.max_attendees > 0 && (
          <div className="mb-3">
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  fillPct >= 100 ? 'bg-red-300' : fillPct >= 75 ? 'bg-amber-200' : 'bg-white'
                )}
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] opacity-90">
              <span>
                {fillPct >= 100
                  ? 'Đã đủ chỗ'
                  : fillPct >= 75
                  ? `Sắp đầy · còn ${session.max_attendees - total} chỗ`
                  : `Còn ${session.max_attendees - total} chỗ trống`}
              </span>
              <span className="font-semibold">{Math.round(fillPct)}%</span>
            </div>
          </div>
        )}

        {/* Avatar stack — Host/Coach + checked-in members */}
        {stack.length > 0 && (
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex -space-x-2">
              {visibleAvatars.map(({ member: a, isCheckedIn }) => {
                const ring = !isCheckedIn
                  ? 'ring-white/40 ring-dashed'
                  : a.is_host
                  ? 'ring-amber-300'
                  : a.is_coach
                  ? 'ring-blue-300'
                  : 'ring-white/60'
                const roleLabel = a.is_host ? 'Host' : a.is_coach ? 'HLV' : ''
                const title = !isCheckedIn
                  ? `${a.full_name}${roleLabel ? ` · ${roleLabel}` : ''} · chưa check-in`
                  : `${a.full_name}${roleLabel ? ` · ${roleLabel}` : ''}`
                return (
                  <div
                    key={a.id}
                    className={cn('relative rounded-full ring-2', ring)}
                    title={title}
                  >
                    <div
                      className={cn(
                        !isCheckedIn && 'grayscale opacity-60'
                      )}
                    >
                      <MemberAvatar member={a} size="sm" />
                    </div>
                    {/* Crown overlay for Host */}
                    {a.is_host && (
                      <span className="absolute -top-1.5 -right-1 text-[10px] leading-none">
                        👑
                      </span>
                    )}
                    {/* Coach badge */}
                    {!a.is_host && a.is_coach && (
                      <span className="absolute -top-1.5 -right-1 text-[10px] leading-none">
                        🎓
                      </span>
                    )}
                  </div>
                )
              })}
              {extraAvatarCount > 0 && (
                <div className="w-8 h-8 rounded-full bg-white/25 backdrop-blur ring-2 ring-white/60 flex items-center justify-center text-[10px] font-bold">
                  +{extraAvatarCount}
                </div>
              )}
            </div>
            <span className="text-[10px] opacity-80 leading-tight">
              {attendees.length > 0
                ? `${attendees.length}/${total} đã CK`
                : `${pendingDefaults.length} Host/HLV mặc định`}
            </span>
          </div>
        )}

        {/* Bottom action — single pill, right-aligned */}
        <div className="flex justify-end mt-1">
          {hasCheckedIn ? (
            <span className="bg-white/25 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 border border-white/40 shadow-sm whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đã check-in
            </span>
          ) : isCancelled ? (
            <span className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap">
              ĐÃ HUỶ
            </span>
          ) : isCompleted ? (
            <span className="bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap">
              ĐÃ XONG
            </span>
          ) : (
            <span className="bg-white text-gray-900 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-md whitespace-nowrap">
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
  walkInCount,
  hasCheckedIn,
}: {
  session: PlaySession
  activityType?: ActivityType
  checkinCount?: number
  walkInCount?: number
  hasCheckedIn?: boolean
}) {
  const style = ACTIVITY_STYLE[session.activity_type]
  const isCancelled = session.status === 'cancelled'
  const total =
    typeof checkinCount === 'number' ? checkinCount + (walkInCount ?? 0) : undefined
  const fillPct =
    typeof total === 'number' && session.max_attendees > 0
      ? Math.min(100, (total / session.max_attendees) * 100)
      : 0
  const accent = session.activity_type === 'training' ? 'bg-amber-500' : 'bg-blue-500'

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
        {typeof total === 'number' && (
          <>
            <span className="text-gray-400">·</span>
            <span>
              {total}/{session.max_attendees}
            </span>
          </>
        )}
        {hasCheckedIn && (
          <CheckCircle2 className="w-3 h-3 text-primary ml-auto flex-shrink-0" />
        )}
      </div>

      {/* Tiny progress bar */}
      {typeof total === 'number' && session.max_attendees > 0 && (
        <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', accent)}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      )}

      {/* Row 3 (optional): HLV name nếu có */}
      {session.instructor_name && (
        <div className="text-[10px] text-amber-700 font-medium truncate mt-0.5">
          HLV: {session.instructor_name}
        </div>
      )}
    </Link>
  )
}

import { Crown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { MemberAvatar } from '../members/MemberAvatar'
import type { Member, SessionCheckin } from '../../types/database'

type Props = {
  hostCoachMembers: Member[]
  checkins: Pick<SessionCheckin, 'member_id'>[]
}

/**
 * Highlight card showing Host & HLV of the session. Grayscale + amber
 * border if not yet checked in, emerald border if checked in.
 */
export function HostCoachRow({ hostCoachMembers, checkins }: Props) {
  if (hostCoachMembers.length === 0) return null

  return (
    <div className="px-4 mt-3">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Crown className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
            Host & HLV của buổi
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {hostCoachMembers.map((m) => {
            const checkedIn = checkins.some((c) => c.member_id === m.id)
            return (
              <div
                key={m.id}
                className={cn(
                  'flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 shadow-sm border',
                  checkedIn ? 'border-emerald-200' : 'border-amber-200'
                )}
                title={
                  checkedIn
                    ? `${m.full_name} · đã check-in`
                    : `${m.full_name} · chưa check-in`
                }
              >
                <div className={cn(!checkedIn && 'grayscale opacity-70')}>
                  <MemberAvatar member={m} size="sm" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-xs font-semibold text-gray-900">
                    {m.full_name}
                  </span>
                  <span
                    className={cn(
                      'text-[9px] font-bold uppercase tracking-wide',
                      m.is_host ? 'text-amber-700' : 'text-blue-700'
                    )}
                  >
                    {m.is_host ? '👑 Host' : '🎓 HLV'}
                    {checkedIn ? ' · ✓ đã check-in' : ' · chưa check-in'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

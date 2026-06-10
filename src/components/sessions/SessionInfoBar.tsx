import { CheckCircle2, Clock, Users, XCircle } from 'lucide-react'
import { cn } from '../../lib/cn'
import { formatVnd } from '../../lib/sessions'
import type { PlaySession, SessionCheckin } from '../../types/database'

type CheckinWindow = {
  canCheckIn: boolean
  reason?: string
  status: 'before' | 'open' | 'after'
}

type CancelWindow = {
  canCancel: boolean
  withPenalty: boolean
  reason?: string
}

type Props = {
  session: PlaySession
  myCheckin: SessionCheckin | undefined
  isFull: boolean
  window: CheckinWindow | null
  cancelWindow: CancelWindow | null
  checking: boolean
  onCheckin: () => void
  onCancelMyCheckin: () => void
}

/**
 * 3-column info bar: Phí Social | Check-in action | Điểm thưởng.
 * Plus a thin row below for cancel link / penalty hint / "chưa mở" reason.
 */
export function SessionInfoBar({
  session,
  myCheckin,
  isFull,
  window,
  cancelWindow,
  checking,
  onCheckin,
  onCancelMyCheckin,
}: Props) {
  return (
    <>
      {/* 3-col */}
      <div className="px-4 -mt-3 grid grid-cols-3 gap-2 relative z-10">
        {/* 1. Phí Social */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
            Phí Social
          </div>
          <div className="text-base font-bold leading-tight mt-0.5">
            {formatVnd(session.price_vnd)}
          </div>
        </div>

        {/* 2. Check-in (giữa) */}
        {myCheckin ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mt-0.5 leading-tight">
              Đã check-in
            </span>
            <span className="text-[9px] text-emerald-600 leading-tight">
              {new Date(myCheckin.checked_in_at).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ) : session.status === 'cancelled' ? (
          <div className="bg-gray-100 border border-gray-200 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <XCircle className="w-5 h-5 text-gray-500" />
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mt-0.5 leading-tight">
              Đã huỷ
            </span>
          </div>
        ) : isFull ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <Users className="w-5 h-5 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mt-0.5 leading-tight">
              Đủ chỗ
            </span>
          </div>
        ) : window?.canCheckIn ? (
          <button
            onClick={onCheckin}
            disabled={checking}
            className="bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition rounded-xl p-2.5 flex flex-col items-center justify-center text-center text-white shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5 leading-tight">
              {checking ? 'Đang...' : 'Check-in'}
            </span>
            {session.points_award > 0 && !checking && (
              <span className="text-[9px] opacity-90 leading-tight">
                +{session.points_award}đ
              </span>
            )}
          </button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-0.5 leading-tight">
              {window?.status === 'before' ? 'Chưa mở' : 'Đã đóng'}
            </span>
          </div>
        )}

        {/* 3. Điểm thưởng */}
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
            Điểm thưởng
          </div>
          <div className="text-base font-bold text-primary leading-tight mt-0.5">
            {session.points_award > 0 ? `+${session.points_award} đ` : '—'}
          </div>
        </div>
      </div>

      {/* Thin row below: cancel link / hint */}
      {myCheckin && (
        <div className="px-4 mt-2 flex items-center justify-between text-[11px] text-gray-600">
          <span>
            ✓ Đã check-in lúc {new Date(myCheckin.checked_in_at).toLocaleString('vi-VN')}
            {myCheckin.points_awarded > 0 && ` · +${myCheckin.points_awarded}đ`}
          </span>
          {cancelWindow?.canCancel ? (
            <button
              onClick={onCancelMyCheckin}
              className={cn(
                'underline whitespace-nowrap ml-2',
                cancelWindow.withPenalty
                  ? 'text-amber-700 font-semibold'
                  : 'text-red-600'
              )}
            >
              {cancelWindow.withPenalty ? '⚠️ Huỷ (-10đ)' : 'Huỷ'}
            </button>
          ) : (
            <span className="text-gray-400 text-[10px] ml-2 whitespace-nowrap">
              {cancelWindow?.reason}
            </span>
          )}
        </div>
      )}
      {!myCheckin && !window?.canCheckIn && window?.reason && (
        <div className="px-4 mt-2 text-[11px] text-gray-500 text-center">
          {window.reason}
        </div>
      )}
      {!myCheckin && isFull && (
        <div className="px-4 mt-2 text-[11px] text-amber-700 text-center">
          Buổi đã đủ {session.max_attendees} người
        </div>
      )}
    </>
  )
}

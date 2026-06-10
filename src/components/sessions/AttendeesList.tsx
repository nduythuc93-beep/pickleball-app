import { AlertTriangle, DollarSign, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { MemberAvatar } from '../members/MemberAvatar'
import type {
  Member,
  SessionCheckin,
  WalkInCheckin,
} from '../../types/database'

export type CheckinRow = SessionCheckin & {
  members: Pick<
    Member,
    'id' | 'full_name' | 'avatar_url' | 'avatar_updated_at' | 'skill_level'
  > | null
}

type Props = {
  checkins: CheckinRow[]
  walkIns: WalkInCheckin[]
  totalAttendees: number
  canManage: boolean
  canAddMembers: boolean
  onOpenAddModal: () => void
  onTogglePaid: (c: CheckinRow) => void
  onWarnCheckin: (c: CheckinRow) => void
  onRemoveCheckin: (c: CheckinRow) => void
  onToggleWalkinPaid: (w: WalkInCheckin) => void
  onRemoveWalkin: (w: WalkInCheckin) => void
}

/**
 * Attendee list — checked-in members on top, walk-ins below.
 * Action buttons (pay, warn, remove) gated by canManage.
 */
export function AttendeesList({
  checkins,
  walkIns,
  totalAttendees,
  canManage,
  canAddMembers,
  onOpenAddModal,
  onTogglePaid,
  onWarnCheckin,
  onRemoveCheckin,
  onToggleWalkinPaid,
  onRemoveWalkin,
}: Props) {
  return (
    <div className="px-4 mt-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700">
          Danh sách điểm danh ({totalAttendees})
        </h2>
        {canManage && canAddMembers && (
          <button
            onClick={onOpenAddModal}
            className="text-xs text-primary font-semibold flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Thêm
          </button>
        )}
      </div>

      {totalAttendees === 0 ? (
        <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-500">
          Chưa có ai check-in
        </div>
      ) : (
        <div className="space-y-2">
          {checkins.length > 0 && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              {checkins.map((c, i) => (
                <MemberCheckinRow
                  key={c.id}
                  checkin={c}
                  isLast={i === checkins.length - 1}
                  canManage={canManage}
                  onTogglePaid={onTogglePaid}
                  onWarnCheckin={onWarnCheckin}
                  onRemoveCheckin={onRemoveCheckin}
                />
              ))}
            </div>
          )}

          {walkIns.length > 0 && (
            <div className="bg-amber-50 rounded-2xl overflow-hidden shadow-sm border border-amber-100">
              <div className="px-3 py-2 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                👋 Vãng lai ({walkIns.length})
              </div>
              {walkIns.map((w, i) => (
                <WalkinRow
                  key={w.id}
                  walkin={w}
                  isLast={i === walkIns.length - 1}
                  canManage={canManage}
                  onTogglePaid={onToggleWalkinPaid}
                  onRemove={onRemoveWalkin}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MemberCheckinRow({
  checkin: c,
  isLast,
  canManage,
  onTogglePaid,
  onWarnCheckin,
  onRemoveCheckin,
}: {
  checkin: CheckinRow
  isLast: boolean
  canManage: boolean
  onTogglePaid: (c: CheckinRow) => void
  onWarnCheckin: (c: CheckinRow) => void
  onRemoveCheckin: (c: CheckinRow) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3',
        !isLast && 'border-b border-gray-100'
      )}
    >
      {c.members ? (
        <MemberAvatar member={c.members} size="sm" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">
            {c.members?.full_name ?? '?'}
          </p>
          {c.is_warned && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-bold whitespace-nowrap flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />
              ĐÃ CẢNH CÁO
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-500">
          {new Date(c.checked_in_at).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {canManage && (
          <button
            onClick={() => onTogglePaid(c)}
            className={cn(
              'p-1.5 rounded-lg text-xs',
              c.is_paid
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            )}
            title={c.is_paid ? 'Đã trả' : 'Chưa trả'}
          >
            <DollarSign className="w-3.5 h-3.5" />
          </button>
        )}
        {!canManage && c.is_paid && (
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">
            Đã trả
          </span>
        )}
        {canManage && (
          <button
            onClick={() => onWarnCheckin(c)}
            className={cn(
              'p-1.5 rounded-lg',
              c.is_warned
                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            )}
            title={
              c.is_warned
                ? 'Đã cảnh cáo · click để undo (admin)'
                : 'Cảnh cáo (check-in nhưng không tham gia)'
            }
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
        )}
        {canManage && (
          <button
            onClick={() => onRemoveCheckin(c)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
            title="Xoá check-in"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function WalkinRow({
  walkin: w,
  isLast,
  canManage,
  onTogglePaid,
  onRemove,
}: {
  walkin: WalkInCheckin
  isLast: boolean
  canManage: boolean
  onTogglePaid: (w: WalkInCheckin) => void
  onRemove: (w: WalkInCheckin) => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 bg-white',
        !isLast && 'border-b border-amber-100'
      )}
    >
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold flex-shrink-0">
        {w.full_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{w.full_name}</p>
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold whitespace-nowrap">
            VÃNG LAI
          </span>
        </div>
        <p className="text-[10px] text-gray-500 truncate">
          {canManage && `📞 ${w.phone} · `}
          {new Date(w.checked_in_at).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {w.referral_source && ` · ${w.referral_source}`}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {canManage && (
          <button
            onClick={() => onTogglePaid(w)}
            className={cn(
              'p-1.5 rounded-lg',
              w.is_paid
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-100 text-gray-500'
            )}
            title={w.is_paid ? 'Đã trả' : 'Chưa trả'}
          >
            <DollarSign className="w-3.5 h-3.5" />
          </button>
        )}
        {!canManage && w.is_paid && (
          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">
            Đã trả
          </span>
        )}
        {canManage && (
          <button
            onClick={() => onRemove(w)}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
            title="Xoá vãng lai"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  DollarSign,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import {
  ACTIVITY_STYLE,
  formatDateFull,
  formatTime,
  formatVnd,
  getCheckinWindow,
  getCancelWindow,
} from '../lib/sessions'
import { cn } from '../lib/cn'
import type {
  ActivityType,
  Member,
  PlaySession,
  SessionCheckin,
  WalkInCheckin,
} from '../types/database'

type CheckinRow = SessionCheckin & {
  members: Pick<Member, 'id' | 'full_name' | 'avatar_url' | 'avatar_updated_at' | 'skill_level'> | null
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member: me, user, isAdmin, refreshMember } = useAuth()

  const [session, setSession] = useState<PlaySession | null>(null)
  const [activityType, setActivityType] = useState<ActivityType | null>(null)
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [walkIns, setWalkIns] = useState<WalkInCheckin[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const isHost = me?.is_host ?? false
  const canManage = isAdmin || isHost

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: s }, { data: ci }, { data: mems }, { data: wi }] = await Promise.all([
      supabase.from('play_sessions').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('session_checkins')
        .select('*, members(id, full_name, avatar_url, avatar_updated_at, skill_level)')
        .eq('session_id', id)
        .order('checked_in_at', { ascending: true }),
      supabase.from('members').select('*').eq('is_active', true).order('full_name'),
      supabase
        .from('walk_in_checkins')
        .select('*')
        .eq('session_id', id)
        .order('checked_in_at', { ascending: true }),
    ])
    const sess = s as PlaySession | null
    setSession(sess)
    setCheckins((ci ?? []) as CheckinRow[])
    setWalkIns((wi ?? []) as WalkInCheckin[])
    setAllMembers((mems ?? []) as Member[])

    if (sess) {
      const { data: at } = await supabase
        .from('activity_types')
        .select('*')
        .eq('key', sess.activity_type)
        .maybeSingle()
      setActivityType(at as ActivityType | null)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const myCheckin = useMemo(
    () => checkins.find((c) => c.member_id === me?.id),
    [checkins, me]
  )
  const window = useMemo(() => (session ? getCheckinWindow(session) : null), [session])
  const cancelWindow = useMemo(() => (session ? getCancelWindow(session) : null), [session])
  const totalAttendees = useMemo(
    () => checkins.length + walkIns.length,
    [checkins, walkIns]
  )
  const isFull = useMemo(
    () => session ? totalAttendees >= session.max_attendees : false,
    [totalAttendees, session]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600 mb-4">Không tìm thấy buổi đánh</p>
        <Link to="/events" className="text-primary underline">Về danh sách</Link>
      </div>
    )
  }

  const style = ACTIVITY_STYLE[session.activity_type]

  async function onCheckin() {
    if (!me) return
    setChecking(true)
    const { error } = await supabase.from('session_checkins').insert({
      session_id: session!.id,
      member_id: me.id,
      points_awarded: session!.points_award,
      checked_in_by: user?.id ?? null,
    })
    setChecking(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(
      session!.points_award > 0
        ? `Check-in thành công! +${session!.points_award} điểm 🎉`
        : 'Check-in thành công!'
    )
    load()
  }

  async function onCancelMyCheckin() {
    if (!myCheckin || !cancelWindow) return
    if (!cancelWindow.canCancel) {
      toast.error(cancelWindow.reason ?? 'Không thể huỷ')
      return
    }
    const msg = cancelWindow.withPenalty
      ? '⚠️ Huỷ gần giờ — bạn sẽ bị TRỪ 10 điểm (nếu có). Tiếp tục?'
      : 'Huỷ check-in?'
    if (!confirm(msg)) return

    const { data, error } = await supabase.rpc('cancel_my_checkin', {
      p_checkin_id: myCheckin.id,
    })
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    const penalty = (data as { penalty?: number } | null)?.penalty ?? 0
    if (penalty > 0) {
      toast.error(`Đã huỷ — bị trừ ${penalty} điểm`, { duration: 4000 })
    } else if (cancelWindow.withPenalty) {
      toast.success('Đã huỷ — không bị trừ vì điểm của bạn = 0')
    } else {
      toast.success('Đã huỷ check-in')
    }
    await refreshMember()
    load()
  }

  async function onTogglePaid(c: CheckinRow) {
    if (!canManage) return
    const newPaid = !c.is_paid
    const { error } = await supabase
      .from('session_checkins')
      .update({
        is_paid: newPaid,
        paid_at: newPaid ? new Date().toISOString() : null,
        paid_marked_by: newPaid ? user?.id ?? null : null,
      })
      .eq('id', c.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(newPaid ? 'Đã đánh dấu trả' : 'Đã bỏ đánh dấu')
    load()
  }

  async function onWarnCheckin(c: CheckinRow) {
    if (!canManage) return
    if (c.is_warned) {
      // Undo warning (admin only)
      if (!isAdmin) {
        toast.error('Chỉ admin được undo cảnh cáo')
        return
      }
      if (!confirm(`Bỏ cảnh cáo cho ${c.members?.full_name ?? '?'}? Sẽ hoàn lại điểm bị trừ.`)) return
      const { data, error } = await supabase.rpc('undo_checkin_warning', {
        p_checkin_id: c.id,
      })
      if (error) {
        toast.error(friendlyError(error))
        return
      }
      const refunded = (data as { refunded?: number } | null)?.refunded ?? 0
      toast.success(`Đã undo cảnh cáo · hoàn ${refunded} điểm`)
      load()
      return
    }
    const memberName = c.members?.full_name ?? '?'
    if (!confirm(`Cảnh cáo ${memberName} (đã check-in nhưng không tham gia)? Sẽ trừ 50% điểm session.`)) return
    const { data, error } = await supabase.rpc('mark_checkin_warned', {
      p_checkin_id: c.id,
    })
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    const penalty = (data as { penalty?: number } | null)?.penalty ?? 0
    toast.error(`Đã cảnh cáo ${memberName} · trừ ${penalty} điểm`, { duration: 4000 })
    load()
  }

  async function onRemoveCheckin(c: CheckinRow) {
    if (!canManage) return
    if (!confirm(`Xoá check-in của ${c.members?.full_name ?? '?'}?`)) return
    const { error } = await supabase.from('session_checkins').delete().eq('id', c.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã xoá')
    load()
  }

  async function onToggleWalkinPaid(w: WalkInCheckin) {
    if (!canManage) return
    const newPaid = !w.is_paid
    const { error } = await supabase
      .from('walk_in_checkins')
      .update({
        is_paid: newPaid,
        paid_at: newPaid ? new Date().toISOString() : null,
        paid_marked_by: newPaid ? user?.id ?? null : null,
      })
      .eq('id', w.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(newPaid ? 'Đã đánh dấu trả' : 'Đã bỏ đánh dấu')
    load()
  }

  async function onRemoveWalkin(w: WalkInCheckin) {
    if (!canManage) return
    if (!confirm(`Xoá vãng lai ${w.full_name}?`)) return
    const { error } = await supabase.from('walk_in_checkins').delete().eq('id', w.id)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã xoá')
    load()
  }

  async function onAddMember(memberId: string) {
    const { error } = await supabase.from('session_checkins').insert({
      session_id: session!.id,
      member_id: memberId,
      points_awarded: session!.points_award,
      checked_in_by: user?.id ?? null,
    })
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success('Đã thêm')
    load()
    setAddModalOpen(false)
  }

  const checkedInIds = new Set(checkins.map((c) => c.member_id))
  const availableToAdd = allMembers.filter((m) => !checkedInIds.has(m.id))

  return (
    <div className="pb-6">
      {/* Hero */}
      <div className={cn('relative text-white overflow-hidden', style.gradient)}>
        <button
          onClick={() => navigate('/events')}
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

      {/* Info bar */}
      <div className="px-4 -mt-3 grid grid-cols-2 gap-2 relative z-10">
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
            Học phí
          </div>
          <div className="text-lg font-bold">{formatVnd(session.price_vnd)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
            Điểm thưởng
          </div>
          <div className="text-lg font-bold text-primary">
            {session.points_award > 0 ? `+${session.points_award} đ` : '—'}
          </div>
        </div>
      </div>

      {/* Instructor + notes */}
      {(session.instructor_name || session.notes) && (
        <div className="px-4 mt-3 space-y-2">
          {session.instructor_name && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm">
              <span className="font-semibold">HLV: </span>
              {session.instructor_name}
            </div>
          )}
          {session.notes && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-gray-700">
              {session.notes}
            </div>
          )}
        </div>
      )}

      {/* Special note cho ball_machine */}
      {session.activity_type === 'ball_machine' && (
        <div className="px-4 mt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            💡 <strong>Ưu tiên</strong> thành viên đã đăng ký Social hôm nay
          </div>
        </div>
      )}

      {/* Check-in action */}
      <div className="px-4 mt-4">
        {myCheckin ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 mb-1" />
            <p className="font-semibold text-emerald-800">Bạn đã check-in</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {new Date(myCheckin.checked_in_at).toLocaleString('vi-VN')}
              {myCheckin.points_awarded > 0 && ` · +${myCheckin.points_awarded}đ`}
            </p>
            {cancelWindow?.canCancel && (
              <>
                <button
                  onClick={onCancelMyCheckin}
                  className={cn(
                    'mt-2 text-xs underline',
                    cancelWindow.withPenalty ? 'text-amber-700 font-semibold' : 'text-red-600'
                  )}
                >
                  {cancelWindow.withPenalty ? '⚠️ Huỷ check-in (trừ 10đ)' : 'Huỷ check-in'}
                </button>
                {cancelWindow.withPenalty && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Sát giờ. Huỷ tự do trước 3h trước session start.
                  </p>
                )}
              </>
            )}
            {!cancelWindow?.canCancel && (
              <p className="text-[10px] text-gray-500 mt-2">{cancelWindow?.reason}</p>
            )}
          </div>
        ) : session.status === 'cancelled' ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-gray-600">
            Buổi này đã huỷ
          </div>
        ) : isFull ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-700">
            Buổi đã đủ người ({session.max_attendees}/{session.max_attendees})
          </div>
        ) : window?.canCheckIn ? (
          <Button onClick={onCheckin} loading={checking} className="w-full">
            <CheckCircle2 className="w-5 h-5 mr-1" />
            Check-in
            {session.points_award > 0 && ` (+${session.points_award}đ)`}
          </Button>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-600">
            {window?.reason}
          </div>
        )}
      </div>

      {/* Attendees */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-700">
            Danh sách điểm danh ({totalAttendees})
          </h2>
          {canManage && availableToAdd.length > 0 && (
            <button
              onClick={() => setAddModalOpen(true)}
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
            {/* Member checkins */}
            {checkins.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {checkins.map((c, i) => (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center gap-3 p-3',
                      i !== checkins.length - 1 && 'border-b border-gray-100'
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
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          )}
                          title={c.is_paid ? 'Đã trả' : 'Chưa trả'}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!canManage && c.is_paid && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold">
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
                ))}
              </div>
            )}

            {/* Walk-in checkins */}
            {walkIns.length > 0 && (
              <div className="bg-amber-50 rounded-2xl overflow-hidden shadow-sm border border-amber-100">
                <div className="px-3 py-2 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  👋 Vãng lai ({walkIns.length})
                </div>
                {walkIns.map((w, i) => (
                  <div
                    key={w.id}
                    className={cn(
                      'flex items-center gap-3 p-3 bg-white',
                      i !== walkIns.length - 1 && 'border-b border-amber-100'
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
                          onClick={() => onToggleWalkinPaid(w)}
                          className={cn(
                            'p-1.5 rounded-lg',
                            w.is_paid
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          )}
                          title={w.is_paid ? 'Đã trả' : 'Chưa trả'}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!canManage && w.is_paid && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-bold">
                          Đã trả
                        </span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => onRemoveWalkin(w)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          title="Xoá vãng lai"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add member modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Check-in hộ thành viên"
      >
        <div className="space-y-1">
          {availableToAdd.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Tất cả thành viên active đã check-in
            </p>
          )}
          {availableToAdd.map((m) => (
            <button
              key={m.id}
              onClick={() => onAddMember(m.id)}
              className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-left"
            >
              <MemberAvatar member={m} size="sm" />
              <div className="flex-1">
                <p className="text-sm font-medium">{m.full_name}</p>
                <p className="text-[10px] text-gray-500">{m.skill_level}</p>
              </div>
              <Plus className="w-4 h-4 text-primary" />
            </button>
          ))}
        </div>
      </Modal>

      {/* Cancel button (admin) */}
      {isAdmin && session.status !== 'cancelled' && (
        <div className="px-4 mt-6">
          <button
            onClick={async () => {
              if (!confirm('Huỷ buổi này?')) return
              await supabase
                .from('play_sessions')
                .update({ status: 'cancelled' })
                .eq('id', session.id)
              toast.success('Đã huỷ')
              load()
            }}
            className="w-full py-2 text-sm text-red-600 border border-red-200 rounded-lg flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" /> Huỷ buổi này
          </button>
        </div>
      )}
    </div>
  )
}

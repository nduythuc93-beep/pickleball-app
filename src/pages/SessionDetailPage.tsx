import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import { MemberAvatar } from '../components/members/MemberAvatar'
import { Modal } from '../components/ui/Modal'
import { SessionHero } from '../components/sessions/SessionHero'
import { SessionInfoBar } from '../components/sessions/SessionInfoBar'
import { HostCoachRow } from '../components/sessions/HostCoachRow'
import {
  AttendeesList,
  type CheckinRow,
} from '../components/sessions/AttendeesList'
import { getCheckinWindow, getCancelWindow } from '../lib/sessions'
import type {
  ActivityType,
  Member,
  PlaySession,
  WalkInCheckin,
} from '../types/database'

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { member: me, user, isAdmin, refreshMember } = useAuth()

  const [session, setSession] = useState<PlaySession | null>(null)
  const [activityType, setActivityType] = useState<ActivityType | null>(null)
  const [checkins, setCheckins] = useState<CheckinRow[]>([])
  const [walkIns, setWalkIns] = useState<WalkInCheckin[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [hostCoachMembers, setHostCoachMembers] = useState<Member[]>([])
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
    const memberList = (mems ?? []) as Member[]
    setAllMembers(memberList)
    setHostCoachMembers(memberList.filter((m) => m.is_host || m.is_coach))

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
      <SessionHero
        session={session}
        activityType={activityType}
        totalAttendees={totalAttendees}
        onBack={() => navigate('/events')}
      />

      <SessionInfoBar
        session={session}
        myCheckin={myCheckin}
        isFull={isFull}
        window={window}
        cancelWindow={cancelWindow}
        checking={checking}
        onCheckin={onCheckin}
        onCancelMyCheckin={onCancelMyCheckin}
      />

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

      <HostCoachRow hostCoachMembers={hostCoachMembers} checkins={checkins} />

      {/* Special note cho ball_machine */}
      {session.activity_type === 'ball_machine' && (
        <div className="px-4 mt-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            💡 <strong>Ưu tiên</strong> thành viên đã đăng ký Social hôm nay
          </div>
        </div>
      )}

      <AttendeesList
        checkins={checkins}
        walkIns={walkIns}
        totalAttendees={totalAttendees}
        canManage={canManage}
        canAddMembers={availableToAdd.length > 0}
        onOpenAddModal={() => setAddModalOpen(true)}
        onTogglePaid={onTogglePaid}
        onWarnCheckin={onWarnCheckin}
        onRemoveCheckin={onRemoveCheckin}
        onToggleWalkinPaid={onToggleWalkinPaid}
        onRemoveWalkin={onRemoveWalkin}
      />

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

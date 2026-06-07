import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'
import { ACTIVITY_STYLE } from '../../lib/sessions'
import type {
  ActivityType,
  ActivityTypeKey,
  PlaySession,
  SessionStatus,
} from '../../types/database'

type Props = {
  open: boolean
  onClose: () => void
  /** undefined = create new, có session = edit */
  session?: PlaySession | null
  activityTypes: ActivityType[]
  onSaved: () => void
}

const STATUS_OPTIONS: Array<{ key: SessionStatus; label: string }> = [
  { key: 'open', label: 'Mở' },
  { key: 'ongoing', label: 'Đang diễn ra' },
  { key: 'completed', label: 'Đã xong' },
  { key: 'cancelled', label: 'Đã huỷ' },
]

export function SessionFormModal({ open, onClose, session, activityTypes, onSaved }: Props) {
  const { user } = useAuth()
  const isEdit = Boolean(session)

  const [activityType, setActivityType] = useState<ActivityTypeKey>('social')
  const [sessionDate, setSessionDate] = useState('')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('10:00')
  const [venue, setVenue] = useState('Sân chung')
  const [maxAttendees, setMaxAttendees] = useState('16')
  const [priceVnd, setPriceVnd] = useState('60000')
  const [pointsAward, setPointsAward] = useState('10')
  const [instructorName, setInstructorName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<SessionStatus>('open')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (session) {
      // Edit mode
      setActivityType(session.activity_type)
      setSessionDate(session.session_date)
      setStartTime(session.start_time.slice(0, 5))
      setEndTime(session.end_time.slice(0, 5))
      setVenue(session.venue)
      setMaxAttendees(String(session.max_attendees))
      setPriceVnd(String(session.price_vnd))
      setPointsAward(String(session.points_award))
      setInstructorName(session.instructor_name ?? '')
      setNotes(session.notes ?? '')
      setStatus(session.status)
    } else {
      // Create mode — default cho hôm nay
      const today = new Date().toISOString().slice(0, 10)
      setActivityType('social')
      setSessionDate(today)
      setStartTime('07:00')
      setEndTime('10:00')
      setVenue('Sân chung')
      setMaxAttendees('16')
      setPriceVnd('60000')
      setPointsAward('10')
      setInstructorName('')
      setNotes('')
      setStatus('open')
    }
  }, [open, session])

  // Auto-fill price/points/end_time khi đổi activity_type (chỉ trong create mode)
  function onChangeActivityType(key: ActivityTypeKey) {
    setActivityType(key)
    if (isEdit) return
    const at = activityTypes.find((a) => a.key === key)
    if (at) {
      setPriceVnd(String(at.default_price_vnd))
      setPointsAward(String(at.default_points))
      // Adjust default time + max by type
      if (key === 'social') {
        setEndTime('10:00')
        setMaxAttendees('16')
      } else if (key === 'training') {
        setEndTime('09:00')
        setMaxAttendees('8')
      } else if (key === 'ball_machine') {
        setEndTime('09:00')
        setMaxAttendees('6')
      }
    }
  }

  async function onSubmit() {
    if (!sessionDate) {
      toast.error('Chọn ngày')
      return
    }
    if (startTime >= endTime) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu')
      return
    }
    setSaving(true)

    const payload = {
      activity_type: activityType,
      session_date: sessionDate,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      venue: venue.trim() || 'Sân chung',
      max_attendees: parseInt(maxAttendees, 10) || 12,
      price_vnd: parseInt(priceVnd, 10) || 0,
      points_award: parseInt(pointsAward, 10) || 0,
      instructor_name: instructorName.trim() || null,
      notes: notes.trim() || null,
      status,
    }

    let error
    if (isEdit && session) {
      ;({ error } = await supabase.from('play_sessions').update(payload).eq('id', session.id))
    } else {
      ;({ error } = await supabase
        .from('play_sessions')
        .insert({ ...payload, schedule_id: null, created_by: user?.id ?? null }))
    }
    setSaving(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(isEdit ? 'Đã cập nhật' : 'Đã tạo session')
    onSaved()
    onClose()
  }

  const requiresInstructor = activityTypes.find((a) => a.key === activityType)?.requires_instructor

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Sửa session' : 'Tạo session thủ công'}
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">Huỷ</Button>
          <Button onClick={onSubmit} loading={saving} className="flex-1">
            {isEdit ? 'Lưu' : 'Tạo'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Activity type */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Loại hoạt động</label>
          <div className="grid grid-cols-3 gap-2">
            {activityTypes.map((at) => {
              const style = ACTIVITY_STYLE[at.key]
              const active = activityType === at.key
              return (
                <button
                  key={at.key}
                  type="button"
                  onClick={() => onChangeActivityType(at.key)}
                  className={cn(
                    'p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1',
                    active ? style.chip + ' border-2' : 'bg-white text-gray-700 border-gray-200'
                  )}
                >
                  <span className="text-xl">{at.icon}</span>
                  <span className="leading-tight">{at.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Date */}
        <Input
          label="Ngày *"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
        />

        {/* Time */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Giờ bắt đầu"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="Giờ kết thúc"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>

        {/* Venue + max */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Sân"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Sân chung"
          />
          <Input
            label="Max người"
            type="number"
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(e.target.value)}
            min={1}
          />
        </div>

        {/* Price + Points */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Giá (VND)"
            type="number"
            value={priceVnd}
            onChange={(e) => setPriceVnd(e.target.value)}
            min={0}
            step={1000}
          />
          <Input
            label="Điểm thưởng"
            type="number"
            value={pointsAward}
            onChange={(e) => setPointsAward(e.target.value)}
            min={0}
          />
        </div>

        {/* Instructor (training) */}
        {requiresInstructor && (
          <Input
            label="HLV"
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
            placeholder="Tên HLV"
          />
        )}

        {/* Notes */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Ghi chú</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Buổi đặc biệt / lưu ý..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        {/* Status (chỉ trong edit) */}
        {isEdit && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
            <div className="grid grid-cols-4 gap-1">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={cn(
                    'py-2 text-xs font-medium border rounded-lg',
                    status === s.key
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

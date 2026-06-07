import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'
import type { SkillLevel, Tournament, TournamentFormat, TournamentStatus } from '../../types/database'

type Props = {
  open: boolean
  onClose: () => void
  tournament?: Tournament | null
  onSaved: () => void
}

const FORMATS: Array<{ key: TournamentFormat; label: string }> = [
  { key: 'round_robin', label: 'Round Robin' },
  { key: 'single_elim', label: 'Single Elim' },
]
const STATUSES: Array<{ key: TournamentStatus; label: string }> = [
  { key: 'draft', label: 'Nháp' },
  { key: 'open', label: 'Mở đăng ký' },
  { key: 'ongoing', label: 'Đang diễn ra' },
  { key: 'completed', label: 'Đã kết thúc' },
]
const SKILLS: SkillLevel[] = ['A', 'B+', 'B-', 'C']

export function TournamentFormModal({ open, onClose, tournament, onSaved }: Props) {
  const { user } = useAuth()
  const isEdit = Boolean(tournament)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('round_robin')
  const [skillFilter, setSkillFilter] = useState<SkillLevel[]>([])
  const [eventDate, setEventDate] = useState('')
  const [venue, setVenue] = useState('')
  const [maxTeams, setMaxTeams] = useState('8')
  const [status, setStatus] = useState<TournamentStatus>('open')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (tournament) {
      setName(tournament.name)
      setDescription(tournament.description ?? '')
      setFormat(tournament.format)
      setSkillFilter(tournament.skill_filter ?? [])
      setEventDate(tournament.event_date ?? '')
      setVenue(tournament.venue ?? '')
      setMaxTeams(tournament.max_teams ? String(tournament.max_teams) : '')
      setStatus(tournament.status)
    } else {
      setName('')
      setDescription('')
      setFormat('round_robin')
      setSkillFilter([])
      const d = new Date()
      d.setDate(d.getDate() + 30)
      setEventDate(d.toISOString().slice(0, 10))
      setVenue('')
      setMaxTeams('8')
      setStatus('open')
    }
  }, [open, tournament])

  function toggleSkill(s: SkillLevel) {
    setSkillFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  async function onSubmit() {
    if (!name.trim()) {
      toast.error('Nhập tên giải')
      return
    }
    setSaving(true)
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      format,
      skill_filter: skillFilter.length > 0 ? skillFilter : null,
      event_date: eventDate || null,
      venue: venue.trim() || null,
      max_teams: maxTeams ? parseInt(maxTeams, 10) : null,
      status,
    }
    let error
    if (isEdit && tournament) {
      ;({ error } = await supabase.from('tournaments').update(payload).eq('id', tournament.id))
    } else {
      ;({ error } = await supabase
        .from('tournaments')
        .insert({ ...payload, created_by: user?.id ?? null }))
    }
    setSaving(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(isEdit ? 'Đã cập nhật' : 'Đã tạo giải')
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Sửa: ${tournament?.name}` : 'Tạo giải mới'}
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
        <Input
          label="Tên giải *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Giải nội bộ CLB tháng 7"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            placeholder="Vui là chính, có giải thưởng nhỏ..."
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Thể thức</label>
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormat(f.key)}
                className={cn(
                  'py-2 rounded-lg text-sm font-medium border',
                  format === f.key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Skill filter (để trống = mở tất cả)</label>
          <div className="flex gap-2">
            {SKILLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSkill(s)}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border',
                  skillFilter.includes(s)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Ngày tổ chức"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <Input
            label="Max teams"
            type="number"
            value={maxTeams}
            onChange={(e) => setMaxTeams(e.target.value)}
            placeholder="8"
          />
        </div>

        <Input
          label="Sân thi đấu"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="Sân Pickleball Quận 7"
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
          <div className="grid grid-cols-4 gap-1">
            {STATUSES.map((s) => (
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
      </div>
    </Modal>
  )
}

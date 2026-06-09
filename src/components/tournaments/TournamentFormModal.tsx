import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { uploadTournamentBanner, removeTournamentBanner } from '../../lib/storage'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'
import type { SkillLevel, Tournament, TournamentFormat, TournamentStatus } from '../../types/database'
import { SKILL_PRESETS } from '../../types/database'

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
const SKILLS: SkillLevel[] = SKILL_PRESETS

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
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

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
      setBannerPreview(tournament.banner_url ?? null)
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
      setBannerPreview(null)
    }
    setBannerFile(null)
  }, [open, tournament])

  function onPickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ảnh tối đa 10MB')
      return
    }
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  async function onRemoveBanner() {
    if (!tournament?.banner_url) {
      // Chưa save, chỉ clear local
      setBannerFile(null)
      setBannerPreview(null)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
      return
    }
    if (!confirm('Xoá banner này?')) return
    try {
      await removeTournamentBanner(tournament.id)
      setBannerFile(null)
      setBannerPreview(null)
      toast.success('Đã xoá banner')
      onSaved()
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

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
    let tournamentId = tournament?.id ?? null
    let error
    if (isEdit && tournament) {
      ;({ error } = await supabase.from('tournaments').update(payload).eq('id', tournament.id))
    } else {
      const { data, error: insErr } = await supabase
        .from('tournaments')
        .insert({ ...payload, created_by: user?.id ?? null })
        .select('id')
        .single()
      error = insErr
      tournamentId = data?.id ?? null
    }

    if (error) {
      setSaving(false)
      toast.error(friendlyError(error))
      return
    }

    // Upload banner nếu có file mới
    if (bannerFile && tournamentId) {
      try {
        await uploadTournamentBanner(tournamentId, bannerFile)
      } catch (err) {
        setSaving(false)
        toast.error(friendlyError(err))
        return
      }
    }

    setSaving(false)
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

        {/* Banner ảnh */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Banner ảnh
            <span className="text-xs text-gray-500 font-normal ml-1">
              (16:9 — tự crop center)
            </span>
          </label>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPickBanner}
            className="hidden"
          />
          {bannerPreview ? (
            <div className="relative rounded-lg overflow-hidden border border-gray-200">
              <img
                src={bannerPreview}
                alt="Banner preview"
                className="w-full aspect-[16/9] object-cover"
              />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-gray-800 hover:bg-white"
                >
                  Đổi ảnh
                </button>
                <button
                  type="button"
                  onClick={onRemoveBanner}
                  className="bg-red-500/90 backdrop-blur px-3 py-1 rounded-full text-xs font-medium text-white hover:bg-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Xoá
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              className="w-full aspect-[16/9] border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs font-medium">Thêm banner ảnh</span>
              <span className="text-[10px]">JPG / PNG / WEBP — max 10MB</span>
            </button>
          )}
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

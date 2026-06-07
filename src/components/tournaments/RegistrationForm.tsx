import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/cn'
import type { Member, Tournament, TournamentRegistration } from '../../types/database'

type Props = {
  open: boolean
  onClose: () => void
  tournament: Tournament
  members: Member[]
  existing?: TournamentRegistration | null
  onSaved: () => void
}

const CATEGORIES = [
  { key: 'mens_doubles', label: 'Nam đôi' },
  { key: 'womens_doubles', label: 'Nữ đôi' },
  { key: 'mixed', label: 'Hỗn hợp' },
] as const

type Category = (typeof CATEGORIES)[number]['key']

export function RegistrationForm({
  open,
  onClose,
  tournament,
  members,
  existing,
  onSaved,
}: Props) {
  const { member: me } = useAuth()
  const [category, setCategory] = useState<Category>('mens_doubles')
  const [partnerId, setPartnerId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (existing) {
      setCategory((existing.category as Category) ?? 'mens_doubles')
      setPartnerId(existing.partner_id ?? '')
    } else {
      setCategory('mens_doubles')
      setPartnerId('')
    }
  }, [open, existing])

  // Tất cả category đều là đôi → luôn cần partner
  const partnerOptions = members.filter((m) => m.id !== me?.id && m.is_active)

  async function onSubmit() {
    if (!me) return
    if (!partnerId) {
      toast.error('Chọn partner ghép cặp')
      return
    }
    setSaving(true)
    const payload = {
      tournament_id: tournament.id,
      member_id: me.id,
      partner_id: partnerId,
      category,
      status: 'pending' as const,
    }
    let error
    if (existing) {
      ;({ error } = await supabase
        .from('tournament_registrations')
        .update(payload)
        .eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('tournament_registrations').insert(payload))
    }
    setSaving(false)
    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(existing ? 'Đã cập nhật đăng ký' : 'Đã đăng ký — đợi admin confirm')
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Sửa đăng ký' : 'Đăng ký giải'}
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">Huỷ</Button>
          <Button onClick={onSubmit} loading={saving} className="flex-1">
            {existing ? 'Cập nhật' : 'Đăng ký'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="font-semibold">{tournament.name}</div>
          {tournament.event_date && (
            <div className="text-xs text-gray-600 mt-1">
              {new Date(tournament.event_date).toLocaleDateString('vi-VN')}
              {tournament.venue && ` · ${tournament.venue}`}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Hạng mục</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={cn(
                  'py-2 rounded-lg text-sm font-medium border',
                  category === c.key
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Partner ghép cặp *</label>
          <select
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
            className="w-full px-3 py-2 min-h-[44px] border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          >
            <option value="">-- Chọn partner --</option>
            {partnerOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} ({m.skill_level})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            Admin sẽ confirm để partner được auto-thêm vào danh sách
          </p>
        </div>
      </div>
    </Modal>
  )
}

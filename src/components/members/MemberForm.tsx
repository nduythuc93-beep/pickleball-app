import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import type { Gender, Member, PlayExperience, SkillLevel } from '../../types/database'
import { PLAY_EXPERIENCE_LABEL, SKILL_PRESETS } from '../../types/database'

type Props = {
  open: boolean
  onClose: () => void
  /** undefined = create new, có member = edit */
  member?: Member | null
  onSaved: () => void
}

const EXPERIENCES: PlayExperience[] = ['beginner', 'under_6m', 'over_6m']

export function MemberForm({ open, onClose, member, onSaved }: Props) {
  const { user } = useAuth()
  const isEdit = Boolean(member)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [zaloId, setZaloId] = useState('')
  const [bio, setBio] = useState('')
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('2.0')
  const [customSkill, setCustomSkill] = useState('')
  const [experience, setExperience] = useState<PlayExperience | ''>('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCoach, setIsCoach] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFullName(member?.full_name ?? '')
      setEmail(member?.email ?? '')
      setPhone(member?.phone ?? '')
      setZaloId(member?.zalo_id ?? '')
      setBio(member?.bio ?? '')
      const initSkill = member?.skill_level ?? '2.0'
      setSkillLevel(initSkill)
      setCustomSkill(SKILL_PRESETS.includes(initSkill) ? '' : initSkill)
      setExperience(member?.play_experience ?? '')
      setGender(member?.gender ?? '')
      setIsAdmin(member?.is_admin ?? false)
      setIsCoach(member?.is_coach ?? false)
      setIsHost(member?.is_host ?? false)
      setIsActive(member?.is_active ?? true)
    }
  }, [open, member])

  async function onSubmit() {
    if (!fullName.trim()) {
      toast.error('Tên không được để trống')
      return
    }
    if (!phone.trim() || phone.trim().length < 9) {
      toast.error('Số điện thoại là bắt buộc (9-15 ký tự)')
      return
    }
    const finalSkill = (customSkill.trim() || skillLevel).trim()
    if (!finalSkill || finalSkill.length > 10) {
      toast.error('Trình độ không hợp lệ (1-10 ký tự)')
      return
    }
    setSaving(true)
    const payload = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      zalo_id: zaloId.trim() || null,
      bio: bio.trim() || null,
      play_experience: experience || null,
      gender: gender || null,
      skill_level: finalSkill,
      is_admin: isAdmin,
      is_coach: isCoach,
      is_host: isHost,
      is_active: isActive,
    }

    let error
    if (isEdit && member) {
      const skillChanged = finalSkill !== member.skill_level
      const updates: Record<string, unknown> = { ...payload }
      if (skillChanged) {
        updates.skill_updated_by = user?.id ?? null
        updates.skill_updated_at = new Date().toISOString()
      }
      ;({ error } = await supabase.from('members').update(updates).eq('id', member.id))
    } else {
      ;({ error } = await supabase.from('members').insert({
        ...payload,
        created_by: user?.id ?? null,
      }))
    }
    setSaving(false)

    if (error) {
      toast.error(friendlyError(error))
      return
    }
    toast.success(isEdit ? 'Đã cập nhật' : 'Đã thêm thành viên')
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Sửa ${member?.full_name}` : 'Thêm thành viên mới'}
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Huỷ
          </Button>
          <Button onClick={onSubmit} loading={saving} className="flex-1">
            {isEdit ? 'Lưu' : 'Thêm'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Họ tên *"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nguyễn Văn A"
          required
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@gmail.com (để member login)"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone *"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xxxxxxxx"
            required
            inputMode="tel"
            minLength={9}
          />
          <Input
            label="Zalo ID"
            value={zaloId}
            onChange={(e) => setZaloId(e.target.value)}
            placeholder="zalo_username"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Giới tính</label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setGender('')}
              className={`py-2 rounded-lg text-xs font-medium border ${
                gender === ''
                  ? 'bg-gray-200 text-gray-700 border-gray-300'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              —
            </button>
            <button
              type="button"
              onClick={() => setGender('male')}
              className={`py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                gender === 'male'
                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              👨 Nam
            </button>
            <button
              type="button"
              onClick={() => setGender('female')}
              className={`py-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                gender === 'female'
                  ? 'bg-pink-50 text-pink-700 border-pink-300'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              👩 Nữ
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Kinh nghiệm chơi
          </label>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setExperience('')}
              className={`py-2 rounded-lg text-xs font-medium border ${
                experience === ''
                  ? 'bg-gray-200 text-gray-700 border-gray-300'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              —
            </button>
            {EXPERIENCES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setExperience(e)}
                className={`py-2 rounded-lg text-xs font-medium border ${
                  experience === e
                    ? 'bg-primary/10 text-primary border-primary'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {PLAY_EXPERIENCE_LABEL[e]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Trình độ DUPR <span className="text-xs text-gray-500">(Host/Coach/Admin chấm)</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {SKILL_PRESETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSkillLevel(s)
                  setCustomSkill('')
                }}
                className={`py-2 rounded-lg text-sm font-medium border ${
                  skillLevel === s && !customSkill
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
              Khác
            </span>
            <input
              type="text"
              value={customSkill}
              onChange={(e) => {
                const v = e.target.value.trim()
                setCustomSkill(e.target.value)
                if (v) setSkillLevel(v)
              }}
              placeholder="VD: 3.5, 4.0..."
              maxLength={10}
              className={`flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                customSkill ? 'border-primary text-primary font-semibold' : 'border-gray-200'
              }`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Roles</label>
          <div className="space-y-2">
            <Checkbox label="Admin" checked={isAdmin} onChange={setIsAdmin} hint="Toàn quyền quản lý app" />
            <Checkbox label="Coach" checked={isCoach} onChange={setIsCoach} hint="Huấn luyện viên" />
            <Checkbox label="Host" checked={isHost} onChange={setIsHost} hint="Tổ chức buổi đánh / đặt sân" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Giới thiệu</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            placeholder="Vài dòng về thành viên..."
          />
        </div>

        {isEdit && (
          <Checkbox
            label="Đang hoạt động"
            checked={isActive}
            onChange={setIsActive}
            hint="Tắt nếu thành viên đã nghỉ — sẽ ẩn khỏi danh sách"
          />
        )}
      </div>
    </Modal>
  )
}

function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer p-2 -mx-2 rounded-lg hover:bg-gray-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 mt-0.5 rounded text-primary focus:ring-primary border-gray-300"
      />
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
    </label>
  )
}
